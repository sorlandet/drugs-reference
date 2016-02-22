function isMobileScreen() {
    if (!Modernizr.mq("only screen")) {
        return false;
    }
    var windowWidth = window.innerWidth;
    var isLandscapeMatch = Modernizr.mq("only screen and (min-device-width: 768px) and (orientation: landscape)") && windowWidth >= 768;
    var isPortraitMatch = Modernizr.mq("only screen and (min-device-width: 600px) and (orientation: portrait)") && windowWidth >= 600;
    return !isLandscapeMatch && !isPortraitMatch;
}

var isMobileDevice = (function() {
    var isMobile = device.mobile() && isMobileScreen();
    return function() {
        return isMobile;
    };
})();

var isTabletDevice = device.tablet;

if (isMobileDevice()) {
    $("meta[name='viewport']").attr("content", "width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=yes");
    React.initializeTouchEvents(true);
}
else {
    $("meta[name='viewport']").attr("content", "width=1024, user-scalable=yes");
}

$("html").addClass("loading");
var isDev = $("html").is(".dev-environment");

$(function () {
    $("html").removeClass("loading");

    if (isDev) {
        $("body").on("click", "a", function (event) {
            var href = event.target.href.replace(location.origin, "");
            if (!event.isDefaultPrevented() && href.lastIndexOf("/") === 0) {
                event.preventDefault();
                location.href = href.substr(1) || "main";
            }
        });
    }
});

function handleCaptcha(request) {
    if (isDev) {
        return;
    }
    if (request.getResponseHeader('CAPTCHA_REQUIRED') === "1") {
        var url = [location.protocol, '//', location.host, location.pathname].join('') + "?b";
        document.cookie = 'captchaRedirectUrl=' + url + ';';
        window.location = "/captcha"
    }
}


function getUrlParams() {
    var params = {};

    window.location.search.replace(/[?&]+([^=&]+)=([^&]*)/gi,
        function (str, key, value) {
            var decodedKey = decodeURIComponent(key);
            var decodedValue = decodeURIComponent(value.replace(/\+/g, " "));

            if (params[decodedKey]) {
                if (_.isArray(params[decodedKey])) {
                    params[decodedKey].push(decodedValue)
                } else {
                    params[decodedKey] = [params[decodedKey], decodedValue];
                }
            } else {
                params[decodedKey] = decodeURIComponent(decodedValue);
            }
        }
    );

    return params;

}

function decimalAdjust(type, value, exp) {

    if (typeof exp === 'undefined' || +exp === 0) {
        return Math[type](value);
    }
    value = +value;
    exp = +exp;

    if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
        return NaN;
    }

    value = value.toString().split('e');
    value = Math[type](+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp)));

    value = value.toString().split('e');
    return +(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp));
}

function roundToTen(value, exp) {
    return decimalAdjust("ceil", value, exp);
}

function getInternetExplorerVersion() {
    var ie = -1;
    try {
        ie = navigator.userAgent.match(/(MSIE |Trident.*rv[ :])([0-9]+)/)[ 2 ];
    }
    catch (e) {
    }
    return ie;
}
