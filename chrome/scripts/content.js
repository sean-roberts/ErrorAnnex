
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
    (document.head||document.documentElement).appendChild(script);

    // Remove the node because it's not needed in the dom
    script.parentNode.removeChild(script);

})(function errorExtensionListener(){

    window.addEventListener('error', function(e){

        var error = {
            errorEventMessage: e.message,
            errorEventUrl: e.filename,
            errorEventLine: e.lineno,
            errorEventColumn: e.colno,
            errorEventStack: e.error ? e.error.stack : null,
            errorEventName: window.event.error.name
        };

        window.dispatchEvent(new CustomEvent('__error__notify__', {detail: error}));

        return false;
    });

});


/**************************
Code that will live in the isolated world
**************************/
;(function(window, undefined){

    var utils = {
        getErrorMessage : function(obj){
            var message = {},
                valid = false;

            if( !obj || Object.prototype.toString.call(obj) !== '[object Object]' ){
                return null;
            }

            if('errorEventMessage' in obj && typeof obj.errorEventMessage === 'string'){
                valid = true;
                message.error = obj.errorEventMessage;
            }

            if('errorEventUrl' in obj && typeof obj.errorEventUrl === 'string'){
                valid = true;
                message.url = obj.errorEventUrl;
            }

            if('errorEventLine' in obj && !isNaN(obj.errorEventLine)){
                valid = true;
                message.line = obj.errorEventLine;
            }

            if('errorEventColumn' in obj && !isNaN(obj.errorEventColumn)){
                valid = true;
                message.column = obj.errorEventColumn;
            }

            if('errorEventStack' in obj && typeof obj.errorEventStack === 'string'){
                valid = true;
                message.stack = obj.errorEventStack;
            }

            if('errorEventName' in obj && typeof obj.errorEventName === 'string'){
                valid = true;
                message.errorName = obj.errorEventName;
            }

            return valid ? message : null;
        }
    };

    window.addEventListener('__error__notify__', function(customEvent){
        var errorMessage;
        if(customEvent && customEvent.detail){
            errorMessage = utils.getErrorMessage(customEvent.detail);
            if( errorMessage ){
                chrome.runtime.sendMessage(JSON.stringify(errorMessage));
            }
        }
    }, false);

})(window);
