 (function() {
   //
   // Disable workers to avoid yet another cross-origin issue (workers need the URL of
   // the script to be loaded, and currently do not allow cross-origin scripts)
   //
   PDFJS.disableWorker = true;

   //
   // Get page info from document, resize canvas accordingly, and render page
   //
   function renderPage(task) {
     // Using promise to fetch the page
     task.pdfDoc.getPage(task.pageNum).then(function(page) {
       var viewport = page.getViewport(task.scale);
       task.canvas.height = viewport.height;
       task.canvas.width = viewport.width;

       // Render PDF page into canvas context
       var renderContext = {
         canvasContext: task.ctx,
         viewport: viewport
       };
       page.render(renderContext);
     });
   }

   function zoom(task, v) {
     task.pdfDoc.getPage(task.pageNum).then(function(page){
       if (v === 1) {
         task.scale = task.scale + 0.1;
         if (task.scale >= 2) {
           task.scale = 2;
         }
       }
       if (v === -1) {
         task.scale = task.scale - 0.1;
         if (task.scale <= 0) {
           task.scale = 0.1;
         }
       }
       if (v === 0) {
         task.scale = 0.8;
       }
       var viewport = page.getViewport(task.scale + 0.1);
       task.canvas.height = viewport.height;
       task.canvas.width = viewport.width;

       // Render PDF page into canvas context
       var renderContext = {
         canvasContext: task.ctx,
         viewport: viewport
       };
       page.render(renderContext);
     });

   }

   function enableDisabledNavButtons(task){
     if (task.pageNum === 1) {
       $("#next").removeClass("disabled");
       $("#prev").addClass("disabled");
     }
     else if (task.pageNum === task.pdfDoc.numPages) {
       $("#prev").removeClass("disabled");
       $("#next").addClass("disabled");
     }
     else {
       $("#next").removeClass("disabled");
       $("#prev").removeClass("disabled");
     }
   }

   function goPreviousPage(task) {
     if (task.pageNum <= 1)
       return;
     task.pageNum--;
     renderPage(task);
     $("#currentPage").text(task.pageNum);
     enableDisabledNavButtons(task);
   }

   function goNextPage(task) {
     if (task.pageNum >= task.pdfDoc.numPages)
       return;
     task.pageNum++;
     renderPage(task);
     $("#currentPage").text(task.pageNum);
     enableDisabledNavButtons(task);
   }

   function loadUserProgress() {
     pybossa.userProgress('opentrials-fda-indications').done(function(data){
       var pct = Math.round((data.done*100)/data.total);
       $("#progress").css("width", pct.toString() +"%");
       $("#progress").attr("title", pct.toString() + "% completed!");
       $("#progress").tooltip({'placement': 'left'}); 
       $("#total").text(data.total);
       $("#done").text(data.done);
     });
   }

   function showPaginationOptions(task) {
     if (task.pagination) {
       $("#currentPage").text(task.pageNum);
       $("#totalPages").text(task.pdfDoc.numPages);
       $(".btn-navigate").show();
       $("#pages").show();
     }
     else {
       $(".btn-navigate").hide();
       $("#pages").hide();
     }
   }

  function alterURL(url) {
    var pdfURL = url.split('/').pop(); // Hack to overcome 3rd party CORS restrictions
    return 'http://51.255.66.26/opentrials/indications_docs/' + pdfURL;
  }

  function loadPdf(pdfURL, task, deferred) {
    PDFJS.getDocument(pdfURL).then(function getPdfHelloWorld(_pdfDoc) {
      task.pdfURL = pdfURL;
      task.pdfDoc = _pdfDoc;
      if (typeof deferred !== 'undefined') {
        deferred.resolve(task);
      } else {
        renderPage(task);
        showPaginationOptions(task);
      }
    });
  }

  pybossa.taskLoaded(function(task, deferred){
    if ( !$.isEmptyObject(task) ) {
      if (task.state=='completed') {
        $('#answer').hide();
        $('#taskcompleted').show();
      }
      var canvas = $("<canvas/>", {"id": "canvas_" + task.id});
      canvas.css("border", "1px solid black");
      var viewport = $("<div/>", {"id": "viewport_" + task.id});
      viewport.css("width",  "100%");
      viewport.css("height", "100%");
      viewport.css("overflow", "auto");
      viewport.css("display", "none");
      viewport.append(canvas);
      $("#document-container").append(viewport);


      $('#viewport_' + task.id).dragscrollable({dragSelector:'#canvas_' + task.id});
      task.canvas = document.getElementById('canvas_' + task.id);
      task.ctx = document.getElementById("canvas_" + task.id).getContext('2d');
      task.scale = 0.9;
      task.pagination = (task.info.page === undefined);
      task.pageNum = task.info.page || 1;

      var firstDocuments = ['letter', 'label'];
      console.log(task);
      var documentsUnordered = task.info.documents;
      task.info.documents = [];

      firstDocuments.map(function(v) {
        documentsUnordered.map(function(doc, index) {
          if (doc.name.toLowerCase() == v) {
            task.info.documents.push(doc);
            documentsUnordered.splice(index, 1);
            return;
          }
        });
      });

      documentsUnordered.map(function(doc, index) {
        task.info.documents.push(doc);
      });

       if (task.info.documents.length > 0) {
         pdfURL = task.info.documents[0].url;
         loadPdf(pdfURL, task, deferred);
       } else {
         deferred.resolve(task);
       }
    } else {
      deferred.resolve(task);
    }

  });

  pybossa.presentTask(function(task, deferred){
    if ( !$.isEmptyObject(task) ) {
      loadUserProgress();

      var userCookie = Cookies.getJSON('remember_token');
      if (typeof userCookie !== 'undefined') {
        var username = userCookie.split('|')[0];
      } else {
        var username = undefined;
      }

      task.indications = [];

      $('#documents-list').html('');
      for (var i=0; i<task.info.documents.length; i++) {
        var doc = task.info.documents[i];
        var listItem = '<option value="'+doc.url+'">'+doc.name+'</option>';
        $('#documents-list').append(listItem);
      }

      $('#documents-list').change(function(){
        task.pdfSource = $(this).val();
        var url = task.pdfSource;
        loadPdf(url, task);
      });

      $(".additional-indication").remove();
      $(".remove-indication").remove();
      $(".input-indication").val('');

      $("#viewport_" + task.id).show();
      showPaginationOptions(task);
      renderPage(task);
      $("#question h1").text(task.info.question);
      $("#task-id").text(task.id);
      $("#loading").hide();
      enableDisabledNavButtons(task);
      $(".btn-zoom").off('click').on('click', function(evt){
        zoom(task, parseInt($(this).attr("value")));
      });
      $(".btn-navigate").off('click').on('click', function(evt){
        if ($(this).attr("value") === "next") {
          goNextPage(task);
          return;
        }
        if ($(this).attr("value") === "prev") {
          goPreviousPage(task);
          return;
        }
      });
      $("fieldset#indications").on('click', '.remove-indication', function(){
        var index = $(this).parent('div').index();
        task.indications.splice(index ,1);
        $(this).parent('div').remove();
        console.log('Indications changed: ', task.indications);
      });
      $("fieldset#indications").on('change', '.input-indication', function(){
        var index = $(this).parent('div').index();
        task.indications[index] = {
          value: $(this).val(),
          document: task.pdfSource,
          page: task.pageNum
        };
        console.log('Indications changed: ', task.indications);
      });
      $("fieldset#indications").on('keyup', '.input-indication', function(){
        if( $(this).val() ) {
          $('.btn-submit').prop('disabled', false);
        } else {
          $('.btn-submit').prop('disabled', true);
        }
      });
      $('.add-indication').click(function(){
        var newField = '<div><input type="text" name="indication" class="form-control input-indication additional-indication">'
                     + '<a class="btn btn-default remove-indication">Remove</a><br class="additional-indication"></div>' ;
        $('fieldset#indications').append(newField);
      });
      $(".btn-skip").off('click').on('click', function(){
        var answer = {
          username: username,
          indications: [],
          document: task.pdfURL,
          page: null,
          skipped: true
        };
        $("#viewport_" + task.id).hide();
        pybossa.saveTask(task.id, answer).done(function(data){
          deferred.resolve();
          $("#success").fadeIn();
          setTimeout(function() { $("#success").fadeOut() }, 2000);
        })
      });
      $(".btn-submit").off('click').on('click', function(){
        var answer = {
            username: username,
            indications: task.indications
        };
        $("#viewport_" + task.id).hide();
        pybossa.saveTask(task.id, answer).done(function(data){
          deferred.resolve();
          $("#success").fadeIn();
          setTimeout(function() { $("#success").fadeOut() }, 2000);
        })
      });
    }
    else {
      $(".skeleton").hide();
      $("#finish").fadeIn();
    }
  });

  pybossa.run('opentrials-fda-indications');
})();
