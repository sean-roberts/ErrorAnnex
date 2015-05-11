var currentTab,
    
    currentHostKey,
    
    // global options info, these are the defaults
    // on initial load -- then we sync
    optionsState = {
        allDomainNotes: false,
        domainNotes: []
    },
    
    getBackground = (function(){
        var bg = null;
        return function(){
            return bg === null ? bg = chrome.extension.getBackgroundPage() : bg;
        };
    })(),

    onExtensionOptionPage = chrome.runtime.getURL('options.html') === window.top.location.href,

    find = {
        one: function(selector){
            return document.querySelector(selector);
        },
        all: function(selector){
            return document.querySelectorAll(selector);
        }
    },

    getOptionState = function(){
        chrome.storage.sync.get(optionsState, function(opts) {

            // keep global access of this
            optionsState = opts;

            var domainSpecific = find.one('#popup_domain');

            domainSpecific.checked = opts.domainNotes.indexOf(currentHostKey) > -1;
            
            if(opts.allDomainNotes){
                domainSpecific.disabled = true;
                find.one('#popup_for_domain').classList.add('disabled');
            }
            

            find.one('#popup_all').checked = opts.allDomainNotes;
        });
    },

    setOptionState = function(){

        var currentDomain = find.one('#popup_domain').checked,
            domainIndex = optionsState.domainNotes.indexOf(currentHostKey);

        // all domains 
        optionsState.allDomainNotes = find.one('#popup_all').checked;

        // domain specific notes
        if(!onExtensionOptionPage){
            if(currentDomain){
                if(domainIndex === -1){
                    optionsState.domainNotes.push(currentHostKey);
                }
            }else if(domainIndex >= 0){
                optionsState.domainNotes.splice(domainIndex, 1);
            }
        }

        chrome.storage.sync.set(optionsState);
    },

    bindEvents = function(){
        var _bind = function(el){
            return Gator(document.querySelector(el));
        };

        _bind('#popup_all').on('change', function(){

            find.one('#popup_domain').disabled = !!this.checked;

            if(this.checked){
                find.one('#popup_for_domain').classList.add('disabled');
            }else {
                find.one('#popup_for_domain').classList.remove('disabled');
            }

            setOptionState();
        });
        _bind('#popup_domain').on('change', setOptionState);
    },

    applyHostNoteOptions = function(hostKey){
        var container = document.getElementById('popup_for_domain');
        
        container.querySelector('b').textContent = hostKey;
        container.classList.remove('hide');
    };


document.addEventListener('DOMContentLoaded', function () {
    
    var background = getBackground(),
        currentTab;

    bindEvents();

    if(onExtensionOptionPage){
        getOptionState();
        return;
    }


    // EVERYTHING BELOW THIS IS CALLED FROM INSIDE EXTENSION

    // grab the currently open tab
    chrome.tabs.query({active:true, currentWindow: true}, function(tabs){
        
        var tab = tabs.length > 0 ? tabs[0] : null;
        
        // populate the global tab access
        currentTab = tab;

        if( tab ){
            currentHostKey = background.utils.getHostKey(tab.url);
            applyHostNoteOptions( currentHostKey );
        }

        getOptionState();

    });
});
