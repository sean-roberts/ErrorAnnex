/**
    GOOGLE ANALYTICS
*/
var _gaq = _gaq || [];

// analytics sessions opened and killed everytime you open the popup. 
// passing the extension id -- not personally identifiable  -- should allow us
// to track usage better.
_gaq.push(['_setAccount', 'UA-60306007-1'], { userId: chrome.runtime.id });
_gaq.push(['_trackPageview']);

(function() {
    var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
    ga.src = 'https://ssl.google-analytics.com/ga.js';
    var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();



// function trackPageview() {
//   _gaq.push(['_trackPageview']);
// }

// function trackEvent(category, action, opt_label, opt_value, opt_noninteraction) {
//   _gaq.push(['_trackEvent', category, action, opt_label, opt_value, opt_noninteraction]);
// }
