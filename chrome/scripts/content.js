
/**************************
Code injected to listen for errors on the web page's context
**************************/
;(function( toInject ){

    // Our facade to get into the web pages context
    // will be adding a script element and injecting code

    var injection = ';(' + toInject + ')();',
        script = document.createElement('script');

    script.textContent = injection;

    // Appending will immediately invoke in the context
    // of the web page running the code
    (document.head || document.documentElement).appendChild(script);

    // Remove the node because it's not needed in the dom
    script.parentNode.removeChild(script);

})(function errorListener(){

    
    window.addEventListener('error', function(e){
        var isIframe = self !== top,
            error = {
                error: e.message,
                url: e.filename,
                line: e.lineno,
                column: e.colno,
                stack: e.error ? e.error.stack : null,
                name: window.event.error ? window.event.error.name : '',
                fromIframe: isIframe,
                iframeName: isIframe ? self.name : '',
                iframeUrl: self.location.href
            };

        window.dispatchEvent(new CustomEvent('__error__notify__', { detail: error }));

        return false;
    });

});


/**************************
Code that will live in the isolated world
**************************/
;(function(window, undefined){

    window.addEventListener('__error__notify__', function(customEvent){

        if(customEvent && customEvent.detail && chrome.runtime){
            chrome.runtime.sendMessage(JSON.stringify(customEvent.detail));
        }else {
			// rare problem, but updating extn after it was in use on a page 
			// seemed to make runtime not available until a page refresh happens
			if(!chrome.runtime){
				console.error('You need to refresh your page for Error Annex to continue listening for Errors');
			}
        }
    }, false);

})(window);
