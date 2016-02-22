var AddressDadata = React.createClass({displayName: "AddressDadata",
    mixins: [EventEmitterMixin, SuggestAddressDaDataMixin],
    getInitialState: function() {
        return {
            value: this.props.value ? decodeURIComponent(this.props.value) : ""
        };
    },
    getDefaultProps: function() {
        return {
            suggestTimeout: 500
        };
    },
    componentWillUnmount: function() {
        if (this.$suggestTimeoutId) {
            clearTimeout(this.$suggestTimeoutId);
        }
    },
    componentWillReceiveProps: function(nextProps) {
        var value = nextProps.value;
        if (_.isObject(value)) {
            value = value.value;
        }
        if (value !== this.state.value) {
            this.setState({
                value: value
            });
        }
    },
    onChange: function(value) {
        if (value === this.state.value) {
            return;
        }

        this.setState({value: value});
        this.props.onChange(this.props.id, value);

        this.getSuggestions(value);
    },
    getSuggestions: function(value) {
        var that = this;

        if (this.$suggestTimeoutId) {
            clearTimeout(this.$suggestTimeoutId);
        }

        this.$suggestionDefer = $.Deferred();
        this.$suggestTimeoutId = setTimeout(function() {
            var queryObject = {
                "query": value,
                "count": 5,
                "restrict_value": true
            };
            if (that.props.city){
                queryObject.locations = [{"city": that.props.city}]
            }
            if (that.props.region){
                queryObject.locations = [{"region": that.props.region}]
            }
            that.suggestAddress(queryObject).then(function(data) {
                if (that.$suggestionDefer.state() !== "rejected") {
                    that.$suggestionDefer.resolve();
                    that.setState({
                        addressSuggests: data
                    });
                }
            });
        }, this.props.suggestTimeout);
    },
    changeIndex: function(fieldId, postalCode) {
        if (postalCode && this.props.linkedFieldIndexId) {
            this.dispatch("valuechanged", { fieldName: fieldId, fieldValue: postalCode });
        }
    },
    onSuggestSelect: function(data){
        this.setState({
            addressSuggests: []
        });

        var text = this.getSuggestionText(data).substring(0, this.props.maxLength);
        var postalCode = this.getSuggestionPostalCode(data);

        this.setState({value: text});
        this.props.onChange(this.props.id, {value: text, invalid: false});

        this.changeIndex(this.props.linkedFieldIndexId, postalCode);
    },
    onSuggestHide: function() {
        this.setState({
            addressSuggests: []
        });
    },
    onBlur: function() {
        if (this.$suggestionDefer && this.$suggestionDefer.state() !== "resolved") {
            this.$suggestionDefer.reject("cancelled");
        }

        this.setState({
            addressSuggests: []
        });
    },
    render: function() {
        return (
            React.createElement(Input, {label: this.props.label, errorMessage: this.props.errorMessage, invalid: this.props.invalid, maxLength: this.props.maxLength,
                className: this.props.className, onChange: this.onChange, value: this.state.value, onFocus: this.props.onFocus, onBlur: this.onBlur},
                 this.state.addressSuggests && this.state.addressSuggests.length ?
                    React.createElement(DropdownElements, {elements: this.state.addressSuggests, onHide: this.onSuggestHide, onElementSelect: this.onSuggestSelect, matchValue: this.state.value})
                : false
            )
        );
    }
});

(function(root) {
var AutofillMixin = {
    onMouseDown:function() {
        if (this.props.autofill) {
            var suggestions = this.calculateSuggestions(this.state.value);

            if (suggestions && suggestions.length) {
                this.setState({open: !this.state.open, suggestions: this.calculateSuggestions(this.state.value)});
            } else {
                this.setState({open: false});
            }
        }
    },
    getElementWidth:function() {
        return this.refs[this.props.id].getDOMNode().getElementsByTagName("input")[0].clientWidth;
    },
    getElementCssTextStyle:function() {
        var element = this.refs[this.props.id].getDOMNode().getElementsByTagName("input")[0];
        var elementStyle = window.getComputedStyle(element, null);

        return elementStyle.fontWeight + " " + elementStyle.fontSize + " " + elementStyle.fontFamily;
    },
    hideSuggestions:function() {
        if (this.props.autofill) {
            this.$dispatchClearSuggestionFields();
            this.setState({open: false});
        }
    },
    showSuggestions:function() {
        if (this.props.autofill && this.state.suggestions && this.state.suggestions.length) {
            this.setState({open: true});
        }
    },
    onElementSelect: function(data){
        this.hideSuggestions();

        if (_.isFunction(this.props.onChange)) {
            this.props.onChange(this.props.id, data.text);
        }

        this.$dispatchAutofillEvent(data, false);
    },
    $dispatchClearSuggestionFields:function() {
        this.dispatch('clearSuggestionFields', {
            fieldSet: this.props.fieldSet,
            groupId: this.props.groupId,
            suggestionPreview: true,
            text: ''
        });
    },
    $dispatchAutofillEvent:function(data, suggestionPreview) {
        var obj = {};

        obj.fieldSet = this.props.fieldSet;
        obj.token = this.props.token;
        obj.suggestionData = data;

        if (suggestionPreview) {
            obj.suggestionPreview = suggestionPreview;
        }

        this.dispatch('autofillLinkedElements', obj);
    },
    onElementHover:function(index) {
        if (index != null) {
            this.$dispatchAutofillEvent(this.state.suggestions[index].data, true);
        }
    },
    getAutofillSuggestions:function() {
        var that = this;

        return getFieldSuggestions(this.props.suggestions, this.props.token, this.props.qualifier, this.props.lang, this.props.groupId);

        function getSuggestionsWithoutDuplicates(suggestions) {
            var visibleSectionFields = getSectionFields(that.props.groupId);

            var visibleSortedSuggestions = suggestions.map(function(suggestion)  {
                var clonedSuggestion = Object.assign({}, suggestion);

                clonedSuggestion.fields = suggestion.fields.filter(function(field)  {
                    return visibleSectionFields.find(function(visibleField)  {
                        return visibleField.token === field.token && isQualifiersEqual(visibleField, field);
                    });
                });

                return clonedSuggestion;
            }).sort(function(a, b)  {
                return b.fields.length - a.fields.length;
            });

            var uniqueSuggestions = [];

            getSuggestionsFilteredBySectionValues(visibleSortedSuggestions, visibleSectionFields).forEach(function(suggestion)  {
                if (!isTokenValuesContainsIn(suggestion.fields, uniqueSuggestions)) {
                    uniqueSuggestions.push(suggestion);
                }
            });

            function getSuggestionsFilteredBySectionValues(suggestions, sectionFields) {
                return visibleSortedSuggestions.filter(function(suggestion)  {
                    return suggestion.fields.every(function(field)  {
                        var sectionField = getFieldFromGroup(sectionFields, field.token);

                        if (sectionField) {
                            if (sectionField.token !== that.props.token) {
                                return isFieldValueContainsInSuggestionOrEmpty(field.value, sectionField.name);
                            } else {
                                return true;
                            }
                        }
                    });
                });
            }

            function isTokenValuesContainsIn(fields, suggestions) {
                if (suggestions.length) {
                    return suggestions.find(function(suggestion)  {
                        return fields.every(function(fieldToFind)  {
                            return suggestion.fields.find(function(field)  {
                                return field.token === fieldToFind.token && field.value === fieldToFind.value;
                            });
                        });
                    });
                } else {
                    return false;
                }
            }

            function isQualifiersEqual(formField, suggestionField) {
                if (!formField.qualifier && (!suggestionField.qualifiers || suggestionField.qualifiers.length)) {
                    return true;
                } else if (suggestionField.qualifiers && suggestionField.qualifiers.length) {
                    return suggestionField.qualifiers.includes(formField.qualifier);
                }
            }

            function getFieldFromGroup(visibleSectionFields, token) {
                return visibleSectionFields.find(function(field)  {
                    return field.token === token;
                });
            }

            function isFieldValueContainsInSuggestionOrEmpty(suggestionValue, fieldName) {
                var fieldValue = that.props.values[fieldName];

                if (!fieldValue) {
                    return true;
                } else if (fieldValue instanceof Object && !!!fieldValue.value) {
                    return true;
                } else if (fieldValue && fieldValue.value) {
                    return suggestionValue.toUpperCase() === fieldValue.value.toUpperCase();
                } else {
                    return suggestionValue.toUpperCase() === fieldValue.toUpperCase();
                }
            }

            return uniqueSuggestions;
        }

        function getFieldSuggestions(suggestions, token, qualifier, lang, groupId) {
            if (token) {
                var uniqueSuggestions = getSuggestionsWithoutDuplicates(suggestions);
                var elementSuggestions = [];

                if (token instanceof Array) {
                    token.forEach(function(tokenElement)  {
                        elementSuggestions = elementSuggestions.concat(getSuggestionsByToken(uniqueSuggestions, tokenElement.name, qualifier, lang, groupId));
                    });
                } else {
                    elementSuggestions = getSuggestionsByToken(uniqueSuggestions, token, qualifier, lang, groupId);
                }

                return elementSuggestions;
            }

            function getSuggestionsByToken(suggestions, tokenElement, qualifier, lang, groupId) {
                var suggestionsByToken = [];

                suggestions.forEach(function(suggestion)  {

                    var elementSuggestion = suggestion.fields.find(function(field)  {
                        if (qualifier) {
                            return field.token === tokenElement && field.qualifiers && field.qualifiers.length && field.qualifiers.includes(qualifier) && field.lang === lang;
                        } else {
                            return field.token === tokenElement && field.lang === lang;
                        }
                    });

                    if (elementSuggestion) {
                        suggestionsByToken.push({
                            text: elementSuggestion.value,
                            note: getSuggestionNote(suggestion, elementSuggestion),
                            data: {
                                time: suggestion.time,
                                fieldSet: suggestion.section,
                                qualifier:qualifier,
                                groupId:groupId,
                                text: elementSuggestion.value
                            }
                        });
                    }
                });

                return suggestionsByToken;
            }
        }

        function getSuggestionNote(suggestion, fieldNoteFor) {
            var note = '';
            var noteArray = [];
            var maxNoteLength = that.getElementWidth() * 2.7;
            var maxNoteLineLength = that.getElementWidth() * 0.9;
            var sectionFields = getSectionFields(that.props.groupId);
            var suggestionFields = suggestion.fields.slice();
            var suggestionFieldsValues = [];

            sectionFields.forEach(function(sectionField)  {
                var suggestionField = suggestionFields.find(function(suggestionField)  {
                    return suggestionField.token === sectionField.token;
                });

                if (suggestionField) {
                    if (fieldNoteFor.token !== suggestionField.token && !!suggestionField.value) {
                        var fieldValueArray = suggestionField.value.split(' ');

                        suggestionFieldsValues.push({values: fieldValueArray, lastIndex: 0, added: false});
                        noteArray.push([]);
                    }
                }
            });

            var noteLength = 0;
            var delimiterLength = getTextWidth("  ", that.getElementCssTextStyle());
            var generateNote = !!noteArray.length;

            while (!!generateNote) {
                suggestionFieldsValues.forEach(function(noteObj, index)  {
                    if (!noteObj.added) {
                        var currentValue = noteObj.values[noteObj.lastIndex];

                        if (currentValue) {
                            addNote(noteObj, currentValue, index);
                        } else {
                            noteObj.added = true;
                        }
                    }
                });

                generateNote = suggestionFieldsValues.find(function(noteObj)  {
                    return !noteObj.added;
                });
            }

            function checkPositionAndAddNoteValue(noteObj, currentValue, index) {
                if (noteObj.values.length - 1 === noteObj.lastIndex) {

                    if (suggestionFieldsValues.length - 1 === index) {
                        noteArray[index].push(currentValue);
                    } else {
                        noteArray[index][noteObj.lastIndex] = currentValue + ", ";
                    }

                    noteObj.added = true;
                } else {
                    noteArray[index].push(currentValue);
                }
            }

            function addNoteTail(noteObj, index) {
                if (noteObj.lastIndex === 0) {
                    return;
                }

                if (suggestionFieldsValues.length - 1 != index) {
                    noteArray[index][noteObj.lastIndex - 1] += "...,";
                } else {
                    noteArray[index][noteObj.lastIndex - 1] += "...";
                }
            }

            function addNote(noteObj, currentValue, index) {
                var valueLength = getTextWidth(currentValue, that.getElementCssTextStyle()) + delimiterLength;

                if (valueLength + noteLength < maxNoteLength && valueLength < maxNoteLineLength) {

                    checkPositionAndAddNoteValue(noteObj, currentValue, index);

                    noteLength += valueLength;
                    noteObj.lastIndex++;
                } else {
                    addNoteTail(noteObj, index);

                    noteObj.added = true;
                }
            }

            function isFieldSame(sectionFields, tokenSuggestion) {
                return sectionFields.some(function(field)  {
                    if (tokenSuggestion.qualifiers && tokenSuggestion.qualifiers instanceof Array && tokenSuggestion.qualifiers.length) {
                        return tokenSuggestion.token === field.token && tokenSuggestion.qualifiers.includes(field.qualifier) && tokenSuggestion.lang === field.lang;
                    } else {
                        return tokenSuggestion.token === field.token && tokenSuggestion.lang === field.lang;
                    }
                });
            }

            function getTextWidth(text, font) {
                var canvas = document.createElement("canvas");
                var context = canvas.getContext("2d");
                context.font = font;
                var metrics = context.measureText(text);

                return metrics.width;
            }

            if (noteArray.length) {
                return noteArray.reduce(function(a, b)  {
                    return a.concat(b);
                }).join(" ");
            } else {
                return "";
            }
        }

        function getSectionFields(groupId) {
            return that.props.formTokens.filter(function(field)  {
                return field.groupId === groupId && !that.props.invisibleFields.includes(field.name);
            });
        }
    },
    calculateSuggestions:function(value) {
        if (!this.props.autofill || !value) {
            return [];
        }

        var that = this;
        var suggestions = this.getAutofillSuggestions() || [];

        if (value) {
            suggestions = suggestions.filter(function(suggestion)  {
                return suggestion.text.substr(0, value.length).toUpperCase() === value.toUpperCase() && suggestion.text.length !== value.length;
            });
        }

        return getLatestSuggestions(suggestions, that.props.suggestionsCount || 5);

        function getLatestSuggestions(suggestions, count) {
            return suggestions.sort(function(a, b)  {
                return b.data.time - a.data.time;
            }).slice(0, count);
        }
    }
}

if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
        exports = module.exports = AutofillMixin;
    }
    exports.AutofillMixin = AutofillMixin;
} else if (typeof define === 'function' && define.amd) {
    define([], function() {
        return AutofillMixin;
    });
} else {
    root['AutofillMixin'] = AutofillMixin;
}

})(this);

var EmptyPageNote = React.createClass({displayName: "EmptyPageNote",
    render: function(){
        var cx = React.addons.classSet;
        var classes = cx({
            "empty-page-note": true,
            "empty-page-note--compact": this.props.compact
        });
        return (
            React.createElement("div", {className: classes},
                React.createElement("div", {className: "empty-page-note__text"}, this.props.text),
                this.props.children
            )
        );
    }
});
var Header = React.createClass({displayName: "Header",
    userMenuElements: [
        {
            text: messages.header.mySendingsTitle,
            data: "tracking"
        },
        {
            text:  messages.header.personalAccount,
            data: "user-profile"
        },
        {
            text: messages.header.quit,
            data: "exit"
        }
    ],
    getInitialState: function() {
        var isAuthorized = this.props.authorized || document.cookie.indexOf("auth=1") !== -1, that = this;
        if (isAuthorized) {
            $.get(this.props.getTrackItemsUpdatedCountUrl, function( data ) {
                that.setState({ updatesCount: data.count });
            });
        }
        this.listenUpdatesCountEvent();
        return {
            authorized: isAuthorized,
            name: this.props.userName ? this.props.userName : messages.header.defUserName,
            /*pendingCount: this.props.hasJustArrived ? 1 : false,*/
            postIdLoginUrl: this.props.postIdLoginUrl ? this.props.postIdLoginUrl : "/pochta-id/build/main.html",
            postIdUserAccountUrl: this.props.postIdUserAccountUrl ? this.props.postIdUserAccountUrl : "",
            trackingURL: this.props.trackingURL ? this.props.trackingURL : "tracking.html",
            postIdLogoutUrl: this.props.postIdLogoutUrl,
            updatesCount: null
        };
    },
    componentDidUpdate: function(prevProps, prevState) {
        var oldShow = prevState.showMobileMenu;
        var newShow = this.state.showMobileMenu;
        if (!oldShow && newShow) {
            setTimeout(function()  {
                $(document).bind("click touchend", this.handleDocumentClick);
                $(document).bind("touchmove", this.preventContentScroll);
            }.bind(this), 0);
        }
        else if (oldShow && !newShow) {
            $(document).unbind("click touchend", this.handleDocumentClick);
            $(document).unbind("touchmove", this.preventContentScroll);
        }
    },
    listenUpdatesCountEvent: function() {
        var that = this;
        if (!document.createEvent) {
            document.documentElement.updatesCountChange = 0;
            document.documentElement.attachEvent("onpropertychange", function(event) {
                if (event.propertyName == "updatesCountChange") {
                    that.decrementUpdatesCount(that);
                    document.documentElement.detachEvent("onpropertychange", arguments.callee);
                }
            });
        } else if (document.addEventListener) {
            document.addEventListener("updatesCountChange", function(e) {
               that.decrementUpdatesCount(that);
            }, false);
        }

    },
    decrementUpdatesCount: function(that) {
        if (that.state.updatesCount) {
            that.setState({updatesCount: --that.state.updatesCount});
        }
    },
    preventContentScroll: function(event) {
        if ($(event.target).is("body")) {
            event.preventDefault();
        }
    },
    handleDocumentClick: function(event) {
        var $target = $(event.target);
        var isInsideMobileMenu = !!$target.closest(this.refs.mobileMenu.getDOMNode()).length;
        if (!isInsideMobileMenu) {
            this.setState({
                showMobileMenu: false
            });
        }
    },
    onBalloonToggle: function() {
        setTimeout(function()  {
            var $balloon = $(this.getDOMNode()).find(".header__user-menu-balloon");
            var $btn = $(this.getDOMNode()).find(".header__btn-user-menu");
            if ($balloon.is(":visible")) {
                $balloon.toggleClass("header__user-menu-balloon--right-align", $btn.width() < $balloon.outerWidth());
            }
        }.bind(this), 0);
    },
    onChange: function(key, val){
        var obj = {};
        obj[key] = val;
        this.setState(obj);
    },
    onUserMenuSelect: function(val){
        if (val === "exit"){
            if(this.state.postIdLogoutUrl) {
                location.href = this.state.postIdLogoutUrl;
            }
            else {
                document.cookie = 'auth=0; expires=Fri, 3 Aug 1970 20:47:11 UTC; path=/';
                location.reload();
            }
        }
        else if (val === "user-profile"){
            location.href = this.state.postIdUserAccountUrl;
        }
        else if (val === "tracking"){
            location.href = this.state.trackingURL;
        }
    },
    onAuthorize: function(){
        location.href = this.state.postIdLoginUrl;
    },
    toggleMobileMenu: function(event) {
        event.preventDefault();
        this.setState({
            showMobileMenu: !this.state.showMobileMenu
        });
    },
    render: function(){
        var cx = React.addons.classSet;
        var allServicesButtonClasses = cx({
            "header__btn-all-services": true
        });
        var isMobile = isMobileDevice();
        var isAuthorized = this.state.authorized;
        var updatesCount = parseInt(this.state.updatesCount);
        var showUpdatesCount = !!(updatesCount) && updatesCount > 0;
        return (
            React.createElement("div", null,
                React.createElement("div", {className: "header"},
                    React.createElement("a", {className: "header__logo", href: "/"}),
                    React.createElement("div", {className: "header__menu"},
                        React.createElement("a", {href: "/support", className: allServicesButtonClasses}, messages.header.support),
                         isAuthorized && showUpdatesCount && React.createElement("a", {href: this.state.trackingURL, className: "header__menu-updates-count"}, updatesCount),
                         isAuthorized &&
                            React.createElement(Balloon, {align: "left", ref: "balloon", elements: this.userMenuElements, onSelect: this.onUserMenuSelect, className: "header__user-menu-balloon", onClick: this.onBalloonToggle},
                                React.createElement("div", {className: "text-button header__btn-user-menu"}, this.state.name)
                            ),

                         !isAuthorized && React.createElement("a", {href: this.state.postIdLoginUrl, className: "header__btn-login", onClick: this.onAuthorize}, messages.header.logIn)
                    ),
                    React.createElement("div", {className: "header__mobile-menu-btn", onTouchEnd: this.toggleMobileMenu, onClick: !isMobile && this.toggleMobileMenu},
                         isAuthorized && showUpdatesCount && React.createElement("div", {className: "header__menu-updates-count"}, updatesCount),
                        React.createElement("div", {className: "header__mobile-menu-btn-icon"})
                    )
                ),
                React.createElement(MobileMenu, React.__spread({ref: "mobileMenu"},  this.state))
            )
        );
    }
});

var MobileMenu = React.createClass({displayName: "MobileMenu",
    getInitialState: function() {
        return null;
    },
    componentWillReceiveProps: function(nextProps) {
        var $stickySummary = $(".product-sticky-summary-container");
        var $body = $("body");
        $body.off("transitionend webkitTransitionEnd");
        var isChanged = nextProps.showMobileMenu !== this.props.showMobileMenu;
        if (!isChanged) {
            return;
        }

        var isIOS = device.ios();

        if (nextProps.showMobileMenu) {
            if (!isIOS) {
                $("html").css("overflow", "hidden");
            }
        }
        else {
            $("html").css("overflow", "");
        }

        if ($stickySummary.length) {
            // Android browser 4.3 and older has broken fixed positioning inside transformed elements
            var isModernBrowser = "transition" in $stickySummary[0].style;

            if (nextProps.showMobileMenu) {
                if (isModernBrowser) {
                    var top = $stickySummary.offset().top - $(".header-container").outerHeight() - (isIOS ? 0 : $("body").scrollTop());
                    $stickySummary.css({
                        "top": top
                    });
                }
            }
            else {
                if (isModernBrowser) {
                    $body.one("transitionend webkitTransitionEnd", function() {
                        $stickySummary.css("top", "");
                        $body.off("transitionend webkitTransitionEnd");
                    });
                }
                else {
                    $stickySummary.css("top", "");
                }
            }
        }
        $body.toggleClass("body--mobile-menu", nextProps.showMobileMenu);
    },
    onTouchStart: function(event) {
        this.startY = event.touches[0].clientY;
    },
    // workaround for iOS bug when scrollable element "hangs" on out-of-bounds scroll start
    onTouchMove: function(event) {
        var oldY = this.startY;
        if (oldY === null) {
            return;
        }
        var newY = event.touches[0].clientY;
        var node = this.refs.menu.getDOMNode();
        var maxScroll = node.scrollHeight - node.offsetHeight;
        var delta = newY - oldY;
        var scrollTop = node.scrollTop;
        var newScroll = node.scrollTop - delta;
        var overTopBounds = !scrollTop && newScroll < 0;
        var underBottomBounds = scrollTop >= maxScroll && newScroll > maxScroll;
        if (overTopBounds || underBottomBounds) {
            this.startY = newY;
            event.preventDefault();
        }
        else {
            this.startY = null;
        }
    },
    render: function() {
        var cx = React.addons.classSet;
        var classes = cx({
            "mobile-menu-wrapper": true,
            "mobile-menu-wrapper--visible": this.props.showMobileMenu
        });
        var path = location.pathname.replace(/.*\/build\/(.*)/, "$1")
                                    .replace(/\/$/, "")
                                    .split("/")
                                    .pop();
        path = "/" + path;
        return (
            React.createElement("div", {className: classes},
                React.createElement("div", {ref: "menu", className: "mobile-menu", onTouchStart: this.onTouchStart, onTouchMove: this.onTouchMove},
                    React.createElement(MobileMenuUser, React.__spread({},  this.props)),
                    React.createElement(MobileMenuSiteNavigation, {path: path}),
                    React.createElement(MobileMenuJuridical, null),
                    React.createElement(MobileMenuCompany, {path: path}),
                    React.createElement(MobileMenuSocials, null)
                )
            )
        );
    }
});

var MobileMenuSiteNavigation = React.createClass({displayName: "MobileMenuSiteNavigation",
    buttons: [
        { link: "/", text: messages.mobileMenu.main },
        { link: "/tracking", text: messages.mobileMenu.tracking},
        { link: "/letters", text: messages.mobileMenu.letters },
        { link: "/parcels", text: messages.mobileMenu.parcels },
        { link: "/money-transfer", text: messages.mobileMenu.moneyTransfer },
        { link: "/offices", text: messages.mobileMenu.postOffices },
        { link: "/courier", text: messages.mobileMenu.courier },
        { link: "/postcards", text: messages.mobileMenu.postcards },
        { link: "/forms-list", text: messages.mobileMenu.formsList },
        { link: "/post-index", text: messages.mobileMenu.index },
        { link: "//zakaznoe.pochta.ru", openInNewTab: "true", text: messages.mobileMenu.eDocs },
        { link: "//podpiska.pochta.ru", openInNewTab: "true", text: React.createElement("span", null, messages.mobileMenu.subscription, React.createElement("span", {className: "main-page__menu-beta-note"}, "beta"))},
        { link: "/support", text: messages.mobileMenu.support }
    ],
    render: function() {
        return (
            React.createElement("div", {className: "mobile-menu__site-navigation"},
                _.map(this.buttons, function(button, i)
                    {return React.createElement(MobileMenuSiteNavigationButton, React.__spread({key: i},  button, {path: this.props.path}));}.bind(this)
                )
            )
        );
    }
});

var MobileMenuSiteNavigationButton = React.createClass({displayName: "MobileMenuSiteNavigationButton",
    render: function() {
        var cx = React.addons.classSet;
        var link = this.props.link;
        var path = this.props.path;
        var isActive = link === path || link === "/" && !path;
        var classes = cx({
            "mobile-menu__site-navigation-button": true,
            "mobile-menu__site-navigation-button--active": isActive
        });
        return (
            isActive ?
                React.createElement("div", {className: classes}, this.props.text)
            :
                React.createElement("a", {href: this.props.link, target: this.props.openInNewTab === "true" ? "_blank" : "_self", className: classes}, this.props.text)
        );
    }
});

var MobileMenuUser = React.createClass({displayName: "MobileMenuUser",
    getInitialState: function() {
        if (this.props.authorized) {
            this.buttons = [
                { name: "username", text: this.props.name, user: true },
                { name: "tracking", link: "/tracking", text: messages.mobileMenu.mySendings, count: null },
                { name: "account", link: this.props.postIdUserAccountUrl, text: messages.mobileMenu.personalAccount },
                { name: "logout", link: this.props.postIdLogoutUrl, text: messages.mobileMenu.logOut }
            ];
        }
        else {
            this.buttons = [
                { link: this.props.postIdLoginUrl, text: messages.mobileMenu.logIn }
            ];
        }
        return null;
    },
    render: function() {
        var updatesCount = parseInt(this.props.updatesCount);
        var cx = React.addons.classSet;
        var classes = cx({
            "mobile-menu__user": true,
            "mobile-menu__user--authorized": this.props.authorized
        });
        return (
            React.createElement("div", {className: classes},
                _.map(this.buttons, function(button, i) {
                    if (button.name === "tracking") {
                        button.count = !!(updatesCount) ? updatesCount : null;
                    }
                    return React.createElement(MobileMenuUserButton, React.__spread({key: i},  button));
                }
                )
            )
        );
    }
});

var MobileMenuUserButton = React.createClass({displayName: "MobileMenuUserButton",
    render: function() {
        var cx = React.addons.classSet;
        var classes = cx({
            "mobile-menu__user-button": true,
            "mobile-menu__user-button--user": this.props.user
        });
        return (
            this.props.link ?
                React.createElement("a", {href: this.props.link, className: classes},
                    this.props.text,
                    !!this.props.count && React.createElement("div", {className: "mobile-menu__user-button-count"}, this.props.count)
                )
            :
                React.createElement("div", {className: classes},
                    this.props.text,
                    !!this.props.count && React.createElement("div", {className: "mobile-menu__user-button-count"}, this.props.count)
                )
        );
    }
});

var MobileMenuJuridical = React.createClass({displayName: "MobileMenuJuridical",
    buttons: [
        { link: "//tracking.pochta.ru", openInNewTab: "true", text: messages.mainPage.mainPageMenuBusiness },
        { link: "//izdatel.russianpost.ru", openInNewTab: "true", text: messages.mainPage.mainPageMenuAgency }
       //{ link: "#", text: "Ð—Ð°ÐºÐ»ÑŽÑ‡ÐµÐ½Ð¸Ðµ Ð´Ð¾Ð³Ð¾Ð²Ð¾Ñ€Ð°" }
    ],
    render: function() {
        return (
            React.createElement("div", {className: "mobile-menu__juridical"},
                _.map(this.buttons, function(button, i)
                    {return React.createElement(MobileMenuJuridicalButton, React.__spread({key: i},  button));}
                )
            )
        );
    }
});

var MobileMenuJuridicalButton = React.createClass({displayName: "MobileMenuJuridicalButton",
    render: function() {
        return React.createElement("a", {href: this.props.link, target: this.props.openInNewTab === "true" ? "_blank" : "_self", className: "mobile-menu__juridical-button"}, this.props.text);
    }
});

var MobileMenuCompany = React.createClass({displayName: "MobileMenuCompany",
    buttons: [
        { link: "/news-list", text: messages.mobileMenu.pressCenter },
        { link: "/about-missia", text: messages.mobileMenu.about }
    ],
    render: function() {
        return (
            React.createElement("div", {className: "mobile-menu__company"},
                _.map(this.buttons, function(button, i)
                    {return React.createElement(MobileMenuCompanyButton, React.__spread({key: i},  button));}
                )
            )
        );
    }
});

var MobileMenuCompanyButton = React.createClass({displayName: "MobileMenuCompanyButton",
    render: function() {
        return React.createElement("a", {href: this.props.link, className: "mobile-menu__company-button"}, this.props.text);
    }
});

var MobileMenuSocials = React.createClass({displayName: "MobileMenuSocials",
    render: function() {
        return (
            React.createElement("div", {className: "mobile-menu__socials"},
                React.createElement("a", {target: "_blank", href: "http://vk.com/russianpost", className: "mobile-menu__socials-button mobile-menu__socials-button--vk"}),
                React.createElement("a", {target: "_blank", href: "http://www.facebook.com/ruspost?filter=2", className: "mobile-menu__socials-button mobile-menu__socials-button--fb"}),
                React.createElement("a", {target: "_blank", href: "https://twitter.com/ruspostofficial", className: "mobile-menu__socials-button mobile-menu__socials-button--twitter"})
            )
        );
    }
});

var HelpBaloonsOperationsMixin = {

    checkIfTooltipShowedByName: function(baloonName) {
        return docCookies.hasItem(baloonName);
    },

    setTooltipShowed: function(baloonName) {
        docCookies.setItem(baloonName, "showed", "Fri, 31 Dec 9999 23:59:59 GMT");
    },

    isTooltipOutdated: function() {
        return moment().isAfter(moment("2016-02-25"));
    }

};
var TrackingHelpBalloon = React.createClass({displayName: "TrackingHelpBalloon",
    render: function(){
        var trackingBalloon = (
            React.createElement("div", null, messages.trackingHelpBaloon.descr)
        );
        return (
            React.createElement(Balloon, {content: trackingBalloon, className: "tracking-help-balloon", containerClassName: "tracking-help-balloon-container"},
                React.createElement("div", {className: "text-button tracking-help " + (this.props.className || "")}, messages.trackingHelpBaloon.howTo, React.createElement("div", {className: "help-button"}))
            )
        );
    }
});
var AddFile = React.createClass({displayName: "AddFile",
    getInitialState: function(){
        return {
            files: [{
                id: _.uniqueId("file-")
            }],
            multiple: this.props.multiple !== false,
            prefix: this.props.prefix ? this.props.prefix : "file-"
        };
    },
    onAdd: function(id){
        var files = this.state.files;
        if (this.state.multiple){
            files.push({id: _.uniqueId("file-")});
        }
        this.setState({files: files});
    },
    onDelete: function(id){
        var files;
        if (this.state.multiple){
            files = _.filter(this.state.files, function(file){
                return file.id !== id;
            });
        }
        else {
            files = [{id: _.uniqueId("file-")}];
        }
        this.setState({files: files});
    },
    render: function(){
        var cx = React.addons.classSet;
        var that = this;
        return (
            React.createElement("div", {className: "add-file" + " " + (this.props.className ? this.props.className : "")},
                React.createElement("form", {action: this.props.uploadURL, method: "POST", encType: "multipart/form-data"},
                    _.map(this.state.files, function(file, i){
                        var name = that.state.prefix;
                        if (that.state.multiple){
                            name += i;
                        }
                        return (
                            React.createElement(AddFileElement, React.__spread({name: name, key: file.id, onAdd: that.onAdd},  that.props, {onDelete: that.onDelete, multiple: that.state.multiple, id: file.id}))
                        );
                    })
                )
            )
        );
    }
});

var AddFileElement = React.createClass({displayName: "AddFileElement",
    getInitialState: function(){
        return {
            addButton: true,
            name: this.props.moreLabel && this.props.files.length ? this.props.moreLabel : this.props.label,
            progress: 0
        };
    },
    componentDidMount: function(){
        var input = this.refs.input.getDOMNode();
        if (window.mOxie){
            var fileInput = new mOxie.FileInput({
                browse_button: this.getDOMNode(),
                multiple: this.props.multiple // allow multiple file selection
            });

            fileInput.onchange = this.handleFile;
            fileInput.init();
        }
    },
    componentWillUpdate: function(nextProps, nextState){
        if (this.state.progress !== nextState.progress){
            this.updateProgress(this.state.progress, nextState.progress);
        }
    },
    updateProgress: function(oldProgress, newProgress){
        $(this.getDOMNode()).circleProgress({
            value: newProgress,
            animationStartValue: oldProgress
        });
    },
    handleFile: function(evt) {
        var that = this;
        var file = $(evt.target).prop('files')[0];

        var onprogress = function(progress){
            var progress = progress.total ? progress.loaded / progress.total : 1;
            that.setState({progress: progress});
        };
        var onloadend = function (evt) {
            that.setState({
                uploaded: true,
                uploading: false
            });
        };

        var formData = window.FormData ? new FormData : new mOxie.FormData();
        formData.append("file", file, file.name);
        $.ajax({
            url: 'upload.php',  //Server script to process data
            type: 'POST',
            xhr: function() {  // Custom XMLHttpRequest
                var myXhr = $.ajaxSettings.xhr();
                if(myXhr.upload){ // Check if upload property exists
                    myXhr.upload.onprogress = onprogress;
                    myXhr.upload.addEventListener("progress", onprogress, false);
                    myXhr.upload.addEventListener("load", onloadend, false);
                }
                return myXhr;
            },
            //Ajax events
            //beforeSend: beforeSendHandler,
            success: onloadend,
            error: function(arg1, arg2){
                return;
            },
            // Form data
            data: formData,
            //Options to tell jQuery not to process data or worry about content-type.
            cache: false,
            contentType: false,
            processData: false
        });

        $(this.getDOMNode()).circleProgress({
            value: 0,
            size: 18,
            animation: {
                duration: 100,
                easing: "linear"
            },
            thickness: 3,
            startAngle: -1.58,
            fill: {
                color: "#999"
            },
            emptyFill: "#FFF"
        });

        this.setState({
            name: file.name,
            size: file.size,
            type: file.type,
            uploading: true,
            addButton: false
        });

        this.props.onAdd(this.props.id);
    },
    onAddClick: function(){
        if (window.mOxie) return;
        var input = this.refs.input.getDOMNode();
        input.click();
    },
    onDeleteClick: function(){
        this.props.onDelete(this.props.id);
    },
    render: function(){
        var cx = React.addons.classSet;
        var elementClasses = cx({
            'add-file-button': true,
            'add-file-button--progress': this.state.uploading,
            'add-file-button--uploaded': this.state.uploaded
        });
        var titleClasses = cx({
            'add-file-button__filename': !this.state.addButton,
            'add-file-button__title': this.state.addButton
        });

        return (
            React.createElement("div", {className: elementClasses, onClick: this.state.addButton ? this.onAddClick : false},
                React.createElement("div", {className: "add-file-button__icon", onClick: this.state.uploaded ? this.onDeleteClick : false}),
                React.createElement("div", {className: titleClasses},  this.state.name),
                React.createElement("input", {name: this.props.name, type: "file", multiple: this.props.multiple, hidden: true, className: "ws-filereader", ref: "input", multiple: false && this.props.multiple, accept: "*", onChange: this.handleFile})
            )
        );
    }
});
var Balloon = React.createClass({displayName: "Balloon",
    mixins: [HelpBaloonsOperationsMixin],
    prepareElements: function(elements) {
        return _.isArray(elements) && _.map(elements, function(element) {
            if (!_.isObject(element)) {
                element = {
                    text: element,
                    data: element
                };
            }
            else if (!_.has(element, "data")) {
                element.data = element.text;
            }
            return element;
        });
    },
    getInitialState: function() {
        return {
            open: this.props.open,
            uid: _.uniqueId("balloon-1"),
            elements: this.prepareElements(this.props.elements),
            align: this.props.align || "center",
            marginLeft: this.props.marginLeft || 0,
            isMenu: !!this.props.elements,
            mount: false
        };
    },
    componentDidMount: function() {
        var node = this.getDOMNode();
        this.setState({
            element: this.props.element || $(node).children().first()
        });
    },
    componentWillUnmount: function() {
        $('body').unbind("click", this.handleDocumentClick);
    },
    componentDidUpdate: function(prevProps, prevState) {
        if (this.state.open) {
            $('body').bind("click", this.handleDocumentClick);
        }
        else {
            $('body').unbind("click", this.handleDocumentClick);
        }
    },
    componentWillMount: function() {
        this.setState({
            open: this.props.open
        });
    },
    componentWillReceiveProps: function(nextProps) {
        var state = {
            elements: this.prepareElements(nextProps.elements)
        };
        if (nextProps.element) {
            state.element = nextProps.element;
        }
        if (_.isBoolean(nextProps.open) && nextProps.open !== this.props.open) {
            state.open = nextProps.open;
        }
        this.setState(state);
    },
    handleDocumentClick: function(event) {
        if (!this.props.help && $(event.target).closest(this.getDOMNode()).length) {
            return;
        }
        this.close();
    },
    open: function() {
        this.setState({
            open: true
        });
    },
    close: function() {
        if (this.props.help) {
            this.setTooltipShowed(this.props.name || "");
        }
        this.setState({
            open: false
        });
    },
    toggle: function(event) {
        event.stopPropagation();

        this.setState({
            open: !this.state.open
        });

        if (_.isFunction(this.props.onClick)) {
            this.props.onClick(event);
        }
    },
    onSelect: function(data) {
        this.close();
        if (_.isFunction(this.props.onSelect)) {
            this.props.onSelect(data);
        }
    },
    render: function() {
        var that = this;
        return (
            React.createElement("span", {className: "balloon-toggle-button " + (this.props.containerClassName || "")},
                 this.props.children && React.addons.cloneWithProps(this.props.children, {
                    onClick: this.props.onClick !== false && this.toggle,
                    ref: "button"
                }),
                React.createElement(React.addons.CSSTransitionGroup, {transitionName: "balloon"},
                     this.state.open && ((this.state.elements && this.state.elements.length) || this.props.content) ?
                        React.createElement(BalloonInner, React.__spread({},  this.state, {key: this.state.uid, className: this.props.className, arrowPosition: this.props.arrowPosition, onClick: this.props.onClick, help: this.props.help, arrow: this.props.arrow}),
                            this.state.elements ?
                                _.map(this.state.elements, function(element, i) {
                                    return React.createElement(BalloonMenuElement, {key: i, onClick: that.onSelect.bind(that, element.data)}, element.text);
                                })
                            : this.props.content
                        )
                    : false
                )
            )
        );
    }
});

var BalloonInner = React.createClass({displayName: "BalloonInner",
    mixins: [React.addons.PureRenderMixin],

    componentDidMount: function() {
        this.show();
    },
    show: function(cb) {
        var $balloon = $(this.getDOMNode());
        var options = _.extend({
            "marginLeft": 0
        }, this.props);

        if (options.element) {
            $balloon.css("left", 0)
            .find(".balloon-arrow").css("left", "");
        }

        if (options.element) {
            var left;
            var $element = $(options.element);
            var $arrow = $balloon.find(".balloon__arrow");
            var elementLeft = $element.offset().left;
            var elementWidth = $element.outerWidth();
            var menuWidth = $balloon.outerWidth();
            var menuLeft = $balloon.offset().left;
            var wndWidth = $(window).innerWidth();
            var elementCenter = options.elementCenter ? options.elementCenter : elementWidth / 2;

            calcAlign();

            var leftMargin = parseFloat($balloon.css('margin-left'));
            if (leftMargin) {
                left += leftMargin;
            }

            $balloon.css("left", left);
        }

        function calcAlign() {
            switch (options.align) {
                case "left":
                    left = elementLeft - menuLeft;

                    if (menuWidth > elementWidth) {
                        $arrow.css("left", elementWidth / 2);
                    }

                    break;
                case "center":
                    left = elementLeft - menuLeft + (elementCenter - menuWidth / 2);

                    if (menuLeft + left < 0) {
                        options.align = "left";
                        calcAlign();
                    }
                    else if (menuLeft + menuWidth + left > wndWidth) {
                        options.align = "right";
                        calcAlign();
                    }

                    break;
                case "right":
                    left = (elementLeft + elementWidth) - (menuLeft + menuWidth);

                    if (menuWidth > elementWidth) {
                        $arrow.css("left", menuWidth - elementWidth + elementCenter);
                    }

                    break;
                default:
                    break;
            }

            return left;
        }
    },
    render: function() {
        var cx = React.addons.classSet;
        var balloonClasses = cx({
            "balloon": true,
            "balloon--menu": this.props.isMenu,
            "balloon--help": this.props.help,
            "balloon--arrow-bottom": this.props.arrowPosition === "bottom"
        });
        return (
            React.createElement("div", {className: balloonClasses + " " + (this.props.className ? this.props.className : ""), onClick: this.props.onClick},
                 !!this.props.arrow &&
                    React.createElement("div", {className: "balloon__arrow"},
                        React.createElement("div", {className: "balloon__arrow-scale-fix"}),
                        React.createElement("div", {className: "balloon__arrow__shadow"})
                    ),

                this.props.children
            )
        );
    }
});

var BalloonMenuElement = React.createClass({displayName: "BalloonMenuElement",
    render: function() {
        return !this.props.link ?
            React.createElement("div", {className: "balloon--menu__element-container", onClick: this.props.onClick},
                React.createElement("div", {className: "balloon--menu__element"},
                    this.props.children
                )
            )
        :
            React.createElement("a", {href: this.props.link, target: this.props.openInNewTab === "true" ? "_blank" : "_self", className: "balloon--menu__element-container", onClick: this.props.onClick},
                React.createElement("div", {className: "balloon--menu__element"},
                    this.props.children
                )
            )
        ;
    }
});

var BlockList = React.createClass({displayName: "BlockList",
    prepareElements: function(elements){
        return elements.map(function(element){
            if (!_.isObject(element)){
                element = {
                    title: element,
                    data: element
                }
            }
            else if (!_.has(element, 'data')){
                element.data = element.title;
            }
            return element;
        });
    },
    getInitialState: function(){
        return {
            elements: this.prepareElements(this.props.elements)
        };
    },
    componentWillReceiveProps: function(nextProps){
        this.setState({elements: this.prepareElements(nextProps.elements)});
    },
    onElementClick: function(element){
        this.props.onElementClick(element.data);
    },
    render: function(){
        var that = this;
        return (
            React.createElement("div", {className: "block-list" + " " + (this.props.className ? this.props.className : "")},
                _.map(this.state.elements, function(element, i){
                    return React.createElement(BlockListElement, React.__spread({key: i},  element, {onClick: that.onElementClick.bind(that, element)}))
                })
            )
        );
    }
});

var BlockListElement = React.createClass({displayName: "BlockListElement",
    render: function(){
        var cx = React.addons.classSet;
        var classes = cx({
            "block-list__element": true,
            "block-list__element--clickable": this.props.clickable !== false && !this.props.open
        });
        return (
            React.createElement("div", {className: classes, onClick: this.props.onClick},
                React.createElement("div", {className: "block-list__element-title"}, this.props.title),
                 this.props.note ?
                    React.createElement("div", {className: "block-list__element-note"}, this.props.note)
                : false
            )
        );
    }
});
var Button = React.createClass({displayName: "Button",
    componentWillReceiveProps: function(nextProps) {
        if (nextProps.loading && !this.props.loading) {
            setTimeout(this.hideCursor, 400);
        }
        else if (!nextProps.loading && this.props.loading) {
            $(this.getDOMNode()).css("cursor", "");
        }
    },
    hideCursor: function() {
        if (this.props.loading && this.isMounted()) {
            $(this.getDOMNode()).css("cursor", "default");
        }
    },
    render: function() {
        var cx = React.addons.classSet;
        var classes = cx({
            "button": true,
            "button--loading": this.props.loading
        });
        return (
            React.createElement("div", {className: (classes + " " + (this.props.className || "")), onClick: this.props.onClick}, React.createElement("span", null, this.props.children))
        );
    }
});

var Checkbox = React.createClass({displayName: "Checkbox",
    mixins: [React.addons.PureRenderMixin],

    getInitialState: function(){
        return {
            checked: this.props.checked === true,
            focus: false
        };
    },
    componentWillReceiveProps: function(nextProps){
        if (_.has(nextProps, 'checked') && nextProps.checked !== this.state.checked){
            this.setState({checked: nextProps.checked});
        }
    },
    onContainerClick: function(event){
        var $target = $(event.target);
        if ($target.is('.checkbox__input') || $target.closest('.checkbox__description').length) return;

        this.onChange();
    },
    onChange: function(){
        var newState = !this.state.checked;
        this.setState({checked: newState});

        if (_.isFunction(this.props.onChange)){
            this.props.onChange(newState);
        }
    },
    onInputFocus: function(){
        this.setState({focus: true});
    },
    onInputBlur: function(){
        this.setState({focus: false});
    },
    render: function(){
        var cx = React.addons.classSet;
        var checkboxClasses = cx({
            'checkbox': true,
            'checkbox--biglabel': this.props.bigLabel,
            'checkbox--focus': this.state.focus,
            'checkbox--nolabel': !this.props.label,
            'checkbox--checked': this.state.checked,
            'checkbox--partially-checked': this.props.partiallyChecked
        });
        return (
            React.createElement("div", {className: checkboxClasses + " " + (this.props.className ? this.props.className : ""), onClick: this.onContainerClick},
                React.createElement("input", {type: "checkbox", className: "checkbox__input", checked: this.state.checked, onChange: this.onChange, onFocus: this.onInputFocus, onBlur: this.onInputBlur}),
                React.createElement("div", {className: "checkbox__icon"}),
                React.createElement("label", {className: "checkbox__text"}, this.props.label),
                this.props.children
            )
        );
    }
});
var CheckboxButton = React.createClass({displayName: "CheckboxButton",
    mixins: [React.addons.PureRenderMixin],

    getInitialState: function(){
        return {
            checked: this.props.checked === true,
            focus: false
        };
    },
    componentWillReceiveProps: function(nextProps){
        if (_.has(nextProps, 'checked') && nextProps.checked !== this.state.checked){
            this.setState({checked: nextProps.checked});
        }
    },
    onContainerClick: function(event){
        this.onChange();
    },
    onChange: function(){
        var newState = !this.state.checked;
        if (!this.props.radio) {
            //this.setState({checked: newState});
        }

        if (_.isFunction(this.props.onChange)){
            this.props.onChange(newState);
        }
    },
    onInputFocus: function(){
        this.setState({focus: true});
    },
    onInputBlur: function(){
        this.setState({focus: false});
    },
    render: function(){
        var cx = React.addons.classSet;
        var checkboxClasses = cx({
            'button': true,
            'button--small': true,
            'button--hover': this.state.focus,
            'button--selected': this.state.checked,
            'button--radio': this.props.radio
        });
        return (
            React.createElement("div", {className: checkboxClasses + " " + (this.props.className ? this.props.className : ""), onClick: this.onContainerClick},
                React.createElement("input", {type: "checkbox", className: "checkbox__input", checked: this.state.checked, onChange: this.onChange, onFocus: this.onInputFocus, onBlur: this.onInputBlur}),
                React.createElement("span", null, this.props.label)
            )
        );
    }
});
var CheckboxesRow = React.createClass({displayName: "CheckboxesRow",
    getInitialState: function(){
        var checkedIndexes = [];
        _.each(this.props.elements, function(element, i){
            if (_.isObject(element) && element.checked){
                checkedIndexes.push(i);
            }
        });
        return {
            checkedIndexes: checkedIndexes
        };
    },
    componentWillReceiveProps: function(nextProps){
        if (this.props.elements !== nextProps.elements){
            var checkedIndexes = [];
            _.each(nextProps.elements, function(element, i){
                if (_.isObject(element) && element.checked){
                    checkedIndexes.push(i);
                }
            });

            this.setState({checkedIndexes: checkedIndexes});
        }
    },
    onCheckboxClick: function(data, index){
        var checkedIndexes = this.state.checkedIndexes;
        var arrayIndex = checkedIndexes.indexOf(index);
        var isChecked = arrayIndex !== -1;
        if (isChecked){
            checkedIndexes.splice(arrayIndex, 1);
        }
        else {
            checkedIndexes.push(index);
        }
        this.setState({checkedIndexes: checkedIndexes});

        if (_.isFunction(this.props.onCheckboxClick)){
            this.props.onCheckboxClick(data, !isChecked);
        }
    },
    render: function(){
        var that = this;
        var cx = React.addons.classSet;
        var rowClasses = cx({
            'checkboxes-row': true
        });
        return (
            React.createElement("div", {className: rowClasses + " " + (this.props.className ? this.props.className : "")},
                 this.props.label ?
                    React.createElement("label", {className: "input__title"}, this.props.label)
                : false,
                _.map(this.props.elements, function(element, i){
                    var isObject = _.isObject(element);
                    var text = isObject ? element.text : element;
                    var retVal = isObject && element.data ? element.data : text;

                    var checkboxClasses = cx({
                        'row-checkbox': true,
                        'row-checkbox--checked': _.contains(that.state.checkedIndexes, i)
                    });

                    return React.createElement("div", {key: i, className: checkboxClasses, onClick: that.onCheckboxClick.bind(that, retVal, i)}, text)
                })
            )
        );
    }
});
var Dropdown = React.createClass({displayName: "Dropdown",
    prepareElements: function(elements){
        return elements.map(function(element){
            if (!_.isObject(element)){
                element = {
                    text: element,
                    data: element
                }
            }
            else if (!_.has(element, 'data')){
                element.data = element.text;
            }
            return element;
        });
    },
    getElementByData: function(elements, data){
        return _.find(elements, function(element){
            return _.isEqual(element.data, data);
        });
    },
    getInitialState: function(){
        var elements = this.prepareElements(this.props.elements);
        var value;

        if (_.has(this.props, 'value')){
            value = this.props.value;
        }
        else if (_.has(this.props, 'dataValue')){
            value = this.getElementByData(elements, this.props.dataValue);
            value = value && value.text;
        }
        else {
            value = "";
        }

        return {
            selectedIndex: null,
            elements: elements,
            open: this.props.open,
            value: value
        };
    },
    componentWillReceiveProps: function(nextProps){
        var elements = this.prepareElements(nextProps.elements);
        var value;

        if (_.has(this.props, 'value')){
            value = this.props.value;
        }
        else if (_.has(this.props, 'dataValue')){
            value = this.getElementByData(elements, nextProps.dataValue);
            value = value && value.text;
        }

        this.setState({
            value: value,
            elements: elements
        });
    },
    componentDidUpdate: function(prevProps, prevState) {
        var that = this;
        if (prevState.open !== this.state.open){
            if (this.state.open){
                this.enableDocumentListeners();
                setTimeout(function(){
                    that.show();
                },0);
            }
            else {
                this.disableDocumentListeners();
                this.hide();
            }
        }
    },
    onFocus: function(){
        this.show();
        if (_.isFunction(this.props.onFocus)){
            this.props.onFocus();
        }
    },
    show: function(){
        this.setState({
            selectedIndex: null,
            open: true
        });
    },
    hide: function(){
        this.setState({open: false});
    },
    onClick: function() {
        if (this.state.open) {
            this.refs.input.getDOMNode().focus();
        }
    },
    onMouseDown: function(event){
        this.setState({open: !this.state.open});
    },
    enableDocumentListeners: function(){
        $(document).bind('click', this.handleDocumentClick);
    },
    disableDocumentListeners: function(){
        $(document).unbind('click', this.handleDocumentClick);
    },
    componentWillUnmount: function(){
        this.disableDocumentListeners();
    },
    onElementHover: function(index){
        this.setState({selectedIndex: index});

        if (_.isFunction(this.props.onElementHover)){
            this.props.onElementHover(index);
        }
    },
    onElementSelect: function(data){
        //this.setState({value: text});
        this.hide();
        if (_.isFunction(this.props.onChange)){
            this.props.onChange(data);
        }
    },
    handleDocumentClick: function(event){
        if (!this.isMounted() || ($(event.target).closest($(this.getDOMNode())).length && !$(event.target).closest('.input__suggest__element').length)){
            return;
        }
        if (this.props.onHide){
            this.props.onHide();
            this.disableDocumentListeners();
        }
        else {
            this.disableDocumentListeners();
            this.setState({open: false});
        }
    },
    render: function() {
        var that = this;
        var cx = React.addons.classSet;
        var dropdownClasses = cx({
            'input': true,
            'input--dropdown': true,
            'input--focus': this.state.open,
            'input--disabled': this.props.disabled
        });
        return (
            React.createElement("div", {className: dropdownClasses + " " + (this.props.className ? this.props.className : ""), onMouseDown: this.onMouseDown, onClick: this.onClick},
                 this.props.label ?
                    React.createElement("label", {className: "input__title"}, this.props.label)
                : false,
                React.createElement("div", {className: "input__dropdown-value"}, this.state.value),
                React.createElement("input", {ref: "input", readOnly: true, value: this.state.value, onBlur: this.hide, onFocus: this.onFocus, placeholder: this.props.placeholder}),
                React.createElement("div", {className: "input__dropdown-icon"}),
                 this.state.open && React.createElement(DropdownElements, React.__spread({},  _.omit(this.props, "className"),  this.state, {onElementSelect: this.onElementSelect}))
            )
        );
    }
});
var DropdownElement = React.createClass({displayName: "DropdownElement",
    getInitialState: function(){
        return {
            value: this.getMatchedText(this.props.value, this.props.matchValue)
        };
    },
    componentWillReceiveProps: function(nextProps){
        this.setState({
            value: this.getMatchedText(nextProps.value, nextProps.matchValue)
        });
    },
    getMatchedText: function(value, matchValue){
        if (!matchValue) return value;

        var text = value;
        var matchText = matchValue;

        var lowerText = text.toLowerCase();
        var words = _.uniq(matchText.trim().replace(/\s+/g, ' ').toLowerCase().split(" "));
        var isMatch = _.every(words, function(word){
            return lowerText.indexOf(word) !== -1;
        });
        if (isMatch){
            _.each(words, function(word){
                var re = new RegExp('(^|[^\xA0])(' + RegExp.escape(word) + ')', "gi");
                text = text.replace(re, '$1\xA0$2\xA0');
            });
            text = text.replace(/\xA0([^\xA0]*)!?\xA0/g, '<span class="input__suggest__element__match">$1</span>');
        }

        return text;
    },
    render: function(){
        var cx = React.addons.classSet;
        var elementClasses = cx({
            'input__suggest__element': true,
            'input__suggest__element--selected': this.props.hover
        });
        var value = this.state.value;
        if (this.props.note) {
            value += ("<div class=\"input__suggest__element-note\">" + this.props.note + "</div>");
        }
        return (
            React.createElement("div", {className: (elementClasses + " " + (this.props.className || "")),
                onMouseDown: this.props.onSelect,
                onMouseOver: this.props.onHover,
                dangerouslySetInnerHTML: {__html: value}}
            )
        );
    }
});
var DropdownElements = React.createClass({displayName: "DropdownElements",
    getInitialState: function() {
        var $el = $("<div style='overflow: scroll; width: 50px'><div/></div>").appendTo("body");
        var browserScrollbarWidth = 50 - $el.children().width();
        $el.remove();
        return {
            selectedIndex: null,
            browserScrollbarWidth: browserScrollbarWidth
        };
    },
    componentWillReceiveProps: function(nextProps) {
        if (this.props.elements !== nextProps.elements) {
            this.onElementHover(null);
        }
    },
    componentDidMount: function() {
        this.enableDocumentListeners();
        var $list = $(this.refs.list.getDOMNode());
        var $wrapper = $(this.getDOMNode());
        $list.css({
            width: $wrapper.width() + this.state.browserScrollbarWidth
            //padding: 0
        });
        var scrollContainerHeight = $wrapper.height();
        var scrollContentHeight = $list[0].scrollHeight;
        this.setState({
            scrollContainerHeight: scrollContainerHeight,
            scrollContentHeight: scrollContentHeight,
            scrollable: scrollContainerHeight < scrollContentHeight
        });
    },
    componentWillUnmount: function() {
        this.disableDocumentListeners();
    },
    onSctollbarMouseDown: function(event) {
        this.setState({
            y: event.clientY,
            startScrollTop: this.refs.list.getDOMNode().scrollTop,
            scrollbarActive: true
        });
        $(document).unbind("mousemove", this.onSctollbarMouseMove);
        $(document).unbind("mouseup", this.onSctollbarMouseUp);
        $(document).bind("mousemove", this.onSctollbarMouseMove);
        $(document).bind("mouseup", this.onSctollbarMouseUp);
        event.preventDefault();
        event.stopPropagation();
    },
    onSctollbarMouseMove: function(event) {
        var y = event.clientY;

        var ratio = this.state.scrollContainerHeight / this.state.scrollContentHeight;
        var height = this.state.scrollContainerHeight * ratio;
        var heightDelta = 0;
        var minHeight = 20;
        if (height < minHeight) {
            heightDelta = minHeight - height;
            ratio = this.state.scrollContainerHeight / (this.state.scrollContentHeight + heightDelta / ratio);
        }
        var maxScroll = this.state.scrollContentHeight * ratio;

        var scrollTop = this.state.startScrollTop + (y - this.state.y) / ratio;
        var newState = {};
        this.refs.list.getDOMNode().scrollTop = scrollTop;
        newState.scrollTop = scrollTop;
        this.setState(newState);
        event.preventDefault();
    },
    onSctollbarMouseUp: function() {
        $(document).unbind("mousemove", this.onSctollbarMouseMove);
        $(document).unbind("mouseup", this.onSctollbarMouseUp);
        setTimeout(function()  {
            this.setState({scrollbarActive: false});
        }.bind(this), 0);
    },
    enableDocumentListeners: function() {
        $(document).bind("keydown", this.handleDocumentKeydown);
        $(document).bind("click", this.handleDocumentClick);
        if (this.refs.list) {
            $(this.refs.list.getDOMNode()).bind("scroll", this.onListScroll);
        }
    },
    disableDocumentListeners: function() {
        $(document).unbind("keydown", this.handleDocumentKeydown);
        $(document).bind("click", this.handleDocumentClick);
        if (this.refs.list) {
            $(this.refs.list.getDOMNode()).unbind("scroll", this.onListScroll);
        }
    },
    onListScroll: function(event) {
        var scrollTop = event.target.scrollTop;
        var ratio = this.state.scrollContainerHeight / this.state.scrollContentHeight;
        var height = this.state.scrollContainerHeight * ratio;
        var heightDelta = 0;
        var minHeight = 20;
        if (height < minHeight) {
            heightDelta = minHeight - height;
            ratio = this.state.scrollContainerHeight / (this.state.scrollContentHeight + heightDelta / ratio);
        }
        this.setState({scrollTop: event.target.scrollTop});
        this.refs.scrollbar.getDOMNode().style.top = this.state.scrollTop * ratio + "px";
    },
    onElementHover: function(index, event) {
        this.setState({selectedIndex: index});

        if (_.isFunction(this.props.onElementHover)) {
            this.props.onElementHover(index, event);
        }
    },
    onElementSelect: function(data) {
        if (_.isFunction(this.props.onElementSelect)) {
            this.props.onElementSelect(data);
        }
    },
    handleDocumentKeydown: function(event) {
        var keyCode = event.keyCode;
        var elements = this.props.elements;
        var maxIndex = elements.length - 1;
        var newIndex;
        var selectedIndex = this.state.selectedIndex;

        switch (keyCode) {
            case 40:
                if (selectedIndex === null) {
                    newIndex = 0;
                }
                else {
                    newIndex = selectedIndex >= maxIndex ? 0 : selectedIndex + 1;
                }

                while (React.isValidElement(elements[newIndex])) {
                    newIndex = newIndex >= maxIndex ? 0 : newIndex + 1;
                }

                this.onElementHover(newIndex, event);
                event.preventDefault();
                break;
            case 38:
                newIndex = selectedIndex && selectedIndex <= maxIndex ? selectedIndex - 1 : maxIndex;

                while (React.isValidElement(elements[newIndex])) {
                    newIndex = newIndex && newIndex <= maxIndex ? newIndex - 1 : maxIndex;
                }

                this.onElementHover(newIndex, event);
                event.preventDefault();
                break;
            case 13:
                if (this.state.selectedIndex === null) {
                    if (_.isFunction(this.props.onHide)) {
                        this.props.onHide();
                    }
                }
                else {
                    var element = this.props.elements[this.state.selectedIndex];
                    var isObject = _.isObject(element);
                    var text = isObject ? element.text : element;
                    var data = isObject && element.data ? element.data : text;

                    this.onElementSelect(data);
                }
                break;
            default:
                break;
        }
    },
    handleDocumentClick: function(event) {
        if (!this.isMounted() || ($(event.target).closest($(this.getDOMNode()).parent()).length && !$(event.target).closest(".input__suggest__element").length)) {
            return;
        }
        if (this.state.scrollbarActive) {
            event.stopImmediatePropagation();
            return;
        }
        if (this.props.onHide) {
            this.props.onHide();
        }
    },
    shouldComponentUpdate: function(nextProps, nextState) {
        var omitProps = _.omit(this.props, ["onHover", "onSelect"]);
        var omitNextProps = _.omit(nextProps, ["onHover", "onSelect"]);
        var omitState = _.omit(this.state, ["scrollTop", "startScrollTop", "y"]);
        var omitNextState = _.omit(nextState, ["scrollTop", "startScrollTop", "y"]);

        return !_.isEqual(omitProps, omitNextProps) || !_.isEqual(omitState, omitNextState);
    },
    render: function() {
        var that = this;
        var cx = React.addons.classSet;
        var suggestWrapperClasses = cx({
            "input__suggest-wrapper": true,
            "input__suggest-wrapper--scrollable": this.state.scrollable
        });

        var ratio = this.state.scrollContainerHeight / this.state.scrollContentHeight;
        var height = this.state.scrollContainerHeight * ratio;
        var heightDelta = 0;
        var minHeight = 20;
        if (height < minHeight) {
            height = minHeight;
        }

        var scrollbarStyle = {
            height: height + "px"
        };

        var scrollbarClasses = cx({
            "input__suggest-scrollbar": true,
            "input__suggest-scrollbar--active": this.state.scrollbarActive
        });
        return (
            React.createElement("div", {className: suggestWrapperClasses + " " + (this.props.className ? this.props.className : "")},
                React.createElement("div", {ref: "list", className: "input__suggest"},
                    _.map(this.props.elements, function(element, i) {
                        if (React.isValidElement(element)) {
                            return React.addons.cloneWithProps(element, {key: i});
                        }
                        var isObject = _.isObject(element);
                        var text = isObject ? element.text : element;
                        var note = isObject && element.note;
                        var retVal = isObject && element.data ? element.data : text;
                        var isHovered = i === that.state.selectedIndex;

                        var onSelect = function() {
                            that.onElementSelect(retVal);
                        };

                        return React.createElement(DropdownElement, {
                                key: i,
                                onSelect: onSelect,
                                value: text,
                                note: note,
                                matchValue: element.match !== false && that.props.matchValue,
                                hover: isHovered,
                                onHover: that.onElementHover.bind(that, i)}
                               );
                    })
                ),
                 this.state.scrollable && React.createElement("div", {style: scrollbarStyle, ref: "scrollbar", className: scrollbarClasses, onMouseDown: this.onSctollbarMouseDown})
            )
        );
    }
});

var EditableTitle = React.createClass({displayName: "EditableTitle",
    mixins: [React.addons.LinkedStateMixin],

    getInitialState: function(){
        return {
            value: this.props.value,
            editing: false,
            editable: this.props.editable !== false
        };
    },
    componentDidMount: function() {
        var input = this.refs.input.getDOMNode();

        // IE8 may not fire focus/blur events without that
        $(input).on("focus", function() {});
        $(input).on("blur", function() {});
    },
    componentWillUnmount: function(){
        $(document).unbind('click', this.onDocumentClick);
    },
    componentWillReceiveProps: function(nextProps){
        var editing = _.has(nextProps, 'editing') ? nextProps.editing : this.state.editing;

        this.setState({
            value: nextProps.value,
            editable: nextProps.editable !== false,
            editing: editing
        }, function()  {
            if (!editing && this.state.editing){
                this.onSave();
            }
        }.bind(this));
    },
    componentWillUpdate: function(nextProps, nextState){
        if (this.state.editing !== nextState.editing) {
            if (nextState.editing){
                $(document).bind('click', this.onDocumentClick);
            }
            else {
                $(document).unbind('click', this.onDocumentClick);
            }
        }
    },
    componentDidUpdate: function(prevProps, prevState){
        if (!prevState.editing && this.state.editing){
            var input = this.refs.input.getDOMNode();
            var len = this.state.value.length;

            input.focus();
            if (input.setSelectionRange) {
                input.setSelectionRange(len, len);
                input.scrollLeft = input.scrollWidth;
            }
        }
    },
    onDocumentClick: function(event){
        if (!this.state.editing) {
            return;
        }

        var inputElement = this.refs.input && this.refs.input.getDOMNode();
        var valueElement = this.refs.value && this.refs.value.getDOMNode();
        var $target = $(event.target);

        if ($target.is(inputElement) || $target.is(valueElement)){
            return;
        }

        this.onSave(event);
    },
    onKeyDown: function(event){
        switch (event.key){
            case "Enter":
                this.onSave(event);
                break;
            case "Escape":
                this.onCancel(event);
                break;
            case "Tab":
                event.preventDefault();
                break;
            default:
                break;
        }
    },
    onSave: function(event){
        if (!this.state.value){
            this.onCancel();
            return;
        }

        if (!_.has(this.props, 'editing')) {
            this.setState({editing: false});
        }

        if (_.isFunction(this.props.onChange)){
            this.props.onChange(this.state.value, event);
        }
    },
    onCancel: function(event){
        this.setState({
            editing: false,
            value: this.props.value
        });

        if (_.isFunction(this.props.onChange)){
            this.props.onChange(this.props.value, event);
        }
    },
    onClick: function(){
        if (this.state.editable && !isMobileDevice()){
            this.setState({editing: true});
            if (_.isFunction(this.props.onFocus)){
                this.props.onFocus();
            }
        }
    },
    render: function(){
        var isEditing = this.state.editing;
        var isEditable = this.state.editable;
        var cx = React.addons.classSet;
        var classes = cx({
            'editable-title': true,
            'editable-title--editing': isEditing,
            'editable-title--editable': isEditable
        });
        return (
            React.createElement("div", {className: classes + " " + (this.props.className || "")},
                React.createElement("input", {autoComplete: "off", ref: "input", className: "editable-title__input", valueLink: this.linkState('value'), onKeyDown: this.onKeyDown, onBlur: this.onSave}),
                React.createElement("div", {className: "editable-title__value-container"},
                    React.createElement("span", {ref: "value", className: "editable-title__value", title: this.state.value}, this.state.value)
                ),
                 !isEditing && React.createElement("div", {className: "editable-title__btn-edit", onClick: this.onClick})
            )
        )
    }
});
var FormRow = React.createClass({displayName: "FormRow",
    render: function(){
        var cx = React.addons.classSet;
        var classes = cx({
            'form-row': true,
            'form-row--paddless-inside': this.props.paddlessInside,
            'form-row--paddless-outside': this.props.paddlessOutside,
            'form-row--removeable': this.props.removeable
        });
        return (
            React.createElement("div", {className: classes + " " + (this.props.className ? this.props.className : "")},
                 this.props.label ?
                    React.createElement("div", {className: "input__title form-row__title"}, this.props.label)
                : false,
                this.props.children,
                 this.props.removeable ?
                    React.createElement("div", {className: "form-row__btn-remove close-button", onClick: this.props.onRemove})
                : false
            )
        );
    }
});
var Input = React.createClass({displayName: "Input",
    getAcceptedChars: function(acceptedChars) {
        if (this.props.type === "price" || this.props.type === "weight") {
            acceptedChars = ["digits", ",", "."];
        }
        if (acceptedChars) {
            acceptedChars = _.chain(acceptedChars)
                             .map(function(chr) {
                                 if (chr === "digits") {
                                     chr = ["0-9"];
                                 }
                                 if (chr === "latin") {
                                     chr = ["A-z"];
                                 }
                                 return chr;
                             })
                             .flatten()
                             .value();

            //var escapedChars = acceptedChars.join().replace(\(\.|\^|\$|\*|\+|\?|\(|\)|\[|\{|\\|\|)\g, "\\$1");
            var reString = "[^" + acceptedChars.join("").replace(/(.)/g, "\$1") + "]";
            acceptedChars = {
                chars: acceptedChars,
                test: function(str) {
                    var re = new RegExp(reString);
                    return !re.test(str);
                },
                replace: function(str) {
                    var re = new RegExp(reString, "g");
                    return str.replace(re, "");
                }
            };

            return acceptedChars;
        }
    },
    getInitialState: function() {
        return {
            focus: false,
            paddingLeft: 0,
            acceptedChars: this.getAcceptedChars(this.props.acceptedChars)
        };
    },
    componentWillReceiveProps: function(nextProps) {
        this.setState({acceptedChars: this.getAcceptedChars(nextProps.acceptedChars)});
    },
    componentDidMount: function() {
        var input = this.refs.input.getDOMNode();
        if (this.props.unit) {
            var $input = $(input);
            var $unit = $(this.refs.unit.getDOMNode());

            var newPadding = parseInt($input.css("padding-right")) + $unit.outerWidth();
            $input.css("padding-right", newPadding);
        }
        //if (!Modernizr.input.placeholder) {
            // IE8 may not fire focus/blur events without that
            $(input).on("focus", function() {});
            $(input).on("blur", function() {});

            this.setState({
                paddingLeft: parseInt($(input).css("padding-left")) + 1
            });
        //}
        if (this.props.focusOnMount) {
            this.refs.input.getDOMNode().focus();
        }
    },
    getInputCursorPosition: function() {
        var input = this.refs.input.getDOMNode();
        var pos = 0;

        if (document.selection) {
            input.focus();
            var sel = document.selection.createRange();
            sel.moveStart("character", -input.value.length);
            pos = sel.text.length;
        }
        else if (_.isNumber(input.selectionStart)) {
            pos = input.selectionStart;
        }

        return pos;
    },
    onFocus: function() {
        this.setState({focus: true});
        if (_.isFunction(this.props.onFocus)) {
            this.props.onFocus();
        }
    },
    onBlur: function() {
        this.setState({focus: false});
        if (_.isFunction(this.props.onBlur)) {
            this.props.onBlur();
        }
    },
    onClick: function() {
        this.refs.input.getDOMNode().focus();
        this.setState({focus: true});
    },
    onKeyDown: function(event) {
        if (event.key === "Enter") {
            if (_.isFunction(this.props.onEnterPress)) {
                this.props.onEnterPress();
            }
            if (this.props.search) {
                this.onSearch(event.target.value);
            }
        }
        if (event.key === "Escape") {
            if (_.isFunction(this.props.onEscPress)) {
                this.props.onEscPress();
            }
        }
        if (_.isFunction(this.props.onKeyDown)) {
            this.props.onKeyDown();
        }
    },
    onKeyPress: function(event) {
        if (this.state.acceptedChars && !this.state.acceptedChars.test(event.key)) {
            event.preventDefault();
        }
    },
    setCaretPos: function(pos) {
        var input;
        var setPos = function() {
            if ("selectionStart" in input && "selectionEnd" in input) {
                input.selectionStart = input.selectionEnd = pos;
            }
            else if ("setSelectionRange" in input) {
                input.setSelectionRange(pos, pos);
            }
            else {
                var range = input.createTextRange();
                range.collapse(true);
                range.moveStart("character", pos);
                range.moveEnd("character", 0);
                range.select();
            }
        };

        if (this.isMounted()) {
            input = this.refs.input.getDOMNode();
            setPos();
            setTimeout(setPos, 0);
        }
    },
    onChange: function(event) {
        if (this.state.acceptedChars) {
            var input = event.target;
            var cursorPos = this.getInputCursorPosition();
            if (this.props.type === "price") {
                event.target.value = event.target.value.replace(/[^0-9,\,,\.]/g, "").replace(/(,|\.)+([0-9]{0,2}).*$/, ",$2").replace(/^0+/, "");
                if (/^,/.test(event.target.value)) {
                    event.target.value = event.target.value.replace(/^,/, "0,");
                    cursorPos++;
                }
            }
            else if (this.props.type === "weight") {
                event.target.value = event.target.value
                                                 .replace(/[^0-9,\,,\.]/g, "")
                                                 .replace(/(,|\.)+([0-9]{0,3}).*$/, ",$2")
                                                 .replace(/^0+/, "0")
                                                 .replace(/^0(\d+)/, "$1");
                if (/^,/.test(event.target.value)) {
                    event.target.value = event.target.value.replace(/^,/, "0,");
                    cursorPos++;
                }
            }
            else {
                event.target.value = this.state.acceptedChars.replace(event.target.value);
            }
            this.setCaretPos(cursorPos);
        }
        if (this.props.type === "date") {
            event.target.value = event.target.value.substr(0, 10);
        }
        if (this.props.onChange) {
            this.props.onChange(event.target.value, event);
        }
    },
    onSearch: function() {
        if (_.isFunction(this.props.onSearch)) {
            this.props.onSearch(this.refs.input.getDOMNode().value);
        }
    },
    onShowPasswordClick: function() {
        this.setState({showPassword: !this.state.showPassword});
    },
    render: function() {
        var isPassword = this.props.type === "password";
        var isDatepicker = this.props.type === "datepicker";
        var isLoading = this.props.loading;
        var cx = React.addons.classSet;
        var inputClasses = cx({
            "input": true,
            "input--focus": this.state.focus && !this.props.disabled,
            "input--label-right": this.props.labelRight,
            "input--label-light": this.props.labelLight,
            "input--invalid": this.props.invalid,
            "input--disabled": this.props.disabled,
            "input--search": !isLoading && this.props.search,
            "input--loading": isLoading,
            "input--datepicker": isDatepicker
        });
        var titleClasses = cx({
            "input__title": true
        });
        var mask = this.props.mask || (this.props.type === "date" && "99.99.9999");
        var type = (this.props.type !== "date" && this.props.type) || "text";
        var unit = this.props.unit;
        if ((!this.props.type && _.isEqual(this.props.acceptedChars, ["digits"])) || this.props.type === "date" || isDatepicker) {
            type = "tel";
        }
        else if ((type === "password" && this.state.showPassword) || type === "price") {
            if (type === "price" && !_.has(this.props, "unit")) {
                //unit = "Ñ€ÑƒÐ±.";
            }
            type = "text";
        }
        else if (type === "weight") {
            type = "tel";
        }
        var showPlaceholder = /*!Modernizr.input.placeholder && */!!this.props.placeholder && !this.props.value;
        return (
            React.createElement("div", {onClick: this.onClick, className: inputClasses + " " + (this.props.className ? this.props.className : "")},
                 this.props.label ?
                    React.createElement("label", {className: titleClasses}, this.props.label)
                : false,
                 !!unit && React.createElement("div", {ref: "unit", className: "input__unit"}, unit),
                 showPlaceholder && React.createElement("div", {ref: "placeholder", className: "input__placeholder", style: {paddingLeft: this.state.paddingLeft}}, this.props.placeholder),
                React.createElement(InputElement, {type: type, readOnly: this.props.disabled, ref: "input", value: this.props.value, onFocus: this.onFocus, onBlur: this.onBlur, onChange: this.props.valueLink ? null : this.onChange, onKeyPress: this.onKeyPress, valueLink: this.props.valueLink, onKeyDown: this.onKeyDown, mask: mask, maxLength: this.props.maxLength}),
                 !isLoading && this.props.search && React.createElement("div", {className: "input__btn-search", onClick: this.onSearch}),
                 isLoading && React.createElement("div", {className: "input__loading-icon"}),
                 this.props.children,
                 this.props.invalid && this.props.errorMessage && React.createElement(InputErrorMessage, null, this.props.errorMessage)
            )
        );
    }
});

var InputErrorMessage = React.createClass({displayName: "InputErrorMessage",
    render: function() {
        return React.createElement("div", {className: "input__error-message"}, this.props.children);
    }
});

// https://github.com/sanniassin/react-input-mask

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var InputElement = React.createClass({
    displayName: "InputElement",

    charsRules: {
        "9": "[0-9]",
        "a": "[A-Za-z]",
        "*": "[A-Za-z0-9]"
    },
    defaultMaskChar: "_",
    lastCaretPos: null,
    isAndroidBrowser: function () {
        var windows = new RegExp("windows", "i");
        var firefox = new RegExp("firefox", "i");
        var android = new RegExp("android", "i");
        var ua = navigator.userAgent;
        return !windows.test(ua) && !firefox.test(ua) && android.test(ua);
    },
    isDOMElement: function (element) {
        return typeof HTMLElement === "object" ? element instanceof HTMLElement // DOM2
        : element.nodeType === 1 && typeof element.nodeName === "string";
    },
    // getDOMNode is deprecated but we need it to stay compatible with React 0.12
    getInputDOMNode: function () {
        var input = this.refs.input;

        // React 0.14
        if (this.isDOMElement(input)) {
            return input;
        }

        return input.getDOMNode();
    },
    getPrefix: function () {
        var state = arguments.length <= 0 || arguments[0] === undefined ? this.state : arguments[0];

        var prefix = "";
        var mask = state.mask;
        var maskLen = mask != null ? mask.length : 0;

        for (var i = 0; i < maskLen && this.isPermanentChar(i, state); ++i) {
            prefix += mask[i];
        }
        return prefix;
    },
    getFilledLength: function (value) {
        var state = arguments.length <= 1 || arguments[1] === undefined ? this.state : arguments[1];

        var i;
        if (value == null) {
            value = state.value;
        }
        var maskChar = state.maskChar;

        if (!maskChar) {
            return value.length;
        }

        for (i = value.length - 1; i >= 0; --i) {
            var char = value[i];
            if (!this.isPermanentChar(i, state) && this.isAllowedChar(char, i, state)) {
                break;
            }
        }

        return ++i || this.getPrefix(state).length;
    },
    getLeftEditablePos: function (pos) {
        for (var i = pos; i >= 0; --i) {
            if (!this.isPermanentChar(i)) {
                return i;
            }
        }
        return null;
    },
    getRightEditablePos: function (pos) {
        var mask = this.state.mask;
        var maskLen = mask != null ? mask.length : 0;
        for (var i = pos; i < maskLen; ++i) {
            if (!this.isPermanentChar(i)) {
                return i;
            }
        }
        return null;
    },
    isEmpty: function () {
        var _this = this;

        var value = arguments.length <= 0 || arguments[0] === undefined ? this.state.value : arguments[0];
        var state = arguments.length <= 1 || arguments[1] === undefined ? this.state : arguments[1];

        return !value.split("").some(function (char, i) {
            return !_this.isPermanentChar(i, state) && _this.isAllowedChar(char, i, state);
        });
    },
    isFilled: function () {
        var value = arguments.length <= 0 || arguments[0] === undefined ? this.state.value : arguments[0];
        var state = arguments.length <= 1 || arguments[1] === undefined ? this.state : arguments[1];
        var maskLen = state.mask != null ? state.mask.length : 0;

        return this.getFilledLength(value, state) === maskLen;
    },
    createFilledArray: function (length, val) {
        var array = [];
        for (var i = 0; i < length; i++) {
            array[i] = val;
        }
        return array;
    },
    formatValue: function (value) {
        var _this2 = this;

        var state = arguments.length <= 1 || arguments[1] === undefined ? this.state : arguments[1];
        var maskChar = state.maskChar;
        var mask = state.mask;
        var maskLen = mask != null ? mask.length : 0;

        if (!maskChar) {
            var prefixLen = this.getPrefix(state).length;
            value = this.insertRawSubstr("", value, 0, state);
            while (value.length > prefixLen && this.isPermanentChar(value.length - 1, state)) {
                value = value.slice(0, value.length - 1);
            }
            return value;
        }
        if (value) {
            var emptyValue = this.formatValue("", state);
            return this.insertRawSubstr(emptyValue, value, 0, state);
        }
        return value.split("").concat(this.createFilledArray(maskLen - value.length, null)).map(function (char, pos) {
            if (_this2.isAllowedChar(char, pos, state)) {
                return char;
            } else if (_this2.isPermanentChar(pos, state)) {
                return mask[pos];
            }
            return maskChar;
        }).join("");
    },
    clearRange: function (value, start, len) {
        var _this3 = this;

        var end = start + len;
        var maskChar = this.state.maskChar;
        if (!maskChar) {
            var prefixLen = this.getPrefix().length;
            value = value.split("").filter(function (char, i) {
                return i < prefixLen || i < start || i >= end;
            }).join("");
            return this.formatValue(value);
        }
        var mask = this.state.mask;
        return value.split("").map(function (char, i) {
            if (i < start || i >= end) {
                return char;
            }
            if (_this3.isPermanentChar(i)) {
                return mask[i];
            }
            return maskChar;
        }).join("");
    },
    replaceSubstr: function (value, newSubstr, pos) {
        return value.slice(0, pos) + newSubstr + value.slice(pos + newSubstr.length);
    },
    insertRawSubstr: function (value, substr, pos) {
        var state = arguments.length <= 3 || arguments[3] === undefined ? this.state : arguments[3];
        var mask = state.mask;
        var maskChar = state.maskChar;
        var maskLen = mask != null ? mask.length : 0;

        var isFilled = this.isFilled(value, state);
        substr = substr.split("");
        for (var i = pos; i < maskLen && substr.length;) {
            if (!this.isPermanentChar(i, state) || mask[i] === substr[0]) {
                var char = substr.shift();
                if (this.isAllowedChar(char, i, state, true)) {
                    if (i < value.length) {
                        if (maskChar || isFilled) {
                            value = this.replaceSubstr(value, char, i);
                        } else {
                            value = this.formatValue(value.substr(0, i) + char + value.substr(i), state);
                        }
                    } else if (!maskChar) {
                        value += char;
                    }
                    ++i;
                }
            } else {
                if (!maskChar && i >= value.length) {
                    value += mask[i];
                }
                ++i;
            }
        }
        return value;
    },
    getRawSubstrLength: function (value, substr, pos) {
        var state = arguments.length <= 3 || arguments[3] === undefined ? this.state : arguments[3];
        var mask = state.mask;
        var maskChar = state.maskChar;
        var maskLen = mask != null ? mask.length : 0;

        substr = substr.split("");
        for (var i = pos; i < maskLen && substr.length;) {
            if (!this.isPermanentChar(i, state) || mask[i] === substr[0]) {
                var char = substr.shift();
                if (this.isAllowedChar(char, i, state, true)) {
                    ++i;
                }
            } else {
                ++i;
            }
        }
        return i - pos;
    },
    isAllowedChar: function (char, pos) {
        var state = arguments.length <= 2 || arguments[2] === undefined ? this.state : arguments[2];
        var allowMaskChar = arguments.length <= 3 || arguments[3] === undefined ? false : arguments[3];
        var mask = state.mask;
        var maskChar = state.maskChar;

        if (this.isPermanentChar(pos, state)) {
            return mask[pos] === char;
        }
        var ruleChar = mask[pos];
        var charRule = this.charsRules[ruleChar];
        return new RegExp(charRule).test(char || "") || allowMaskChar && char === maskChar;
    },
    isPermanentChar: function (pos) {
        var state = arguments.length <= 1 || arguments[1] === undefined ? this.state : arguments[1];

        return state.permanents.indexOf(pos) !== -1;
    },
    setCaretToEnd: function () {
        var filledLen = this.getFilledLength();
        var pos = this.getRightEditablePos(filledLen);
        if (pos !== null) {
            this.setCaretPos(pos);
        }
    },
    getSelection: function () {
        var input = this.getInputDOMNode();
        var start = 0;
        var end = 0;

        if ("selectionStart" in input && "selectionEnd" in input) {
            start = input.selectionStart;
            end = input.selectionEnd;
        } else {
            var range = document.selection.createRange();
            var len = input.value.length;

            var inputRange = input.createTextRange();
            inputRange.moveToBookmark(range.getBookmark());

            start = -inputRange.moveStart("character", -len);
            end = -inputRange.moveEnd("character", -len);
        }

        return {
            start: start,
            end: end,
            length: end - start
        };
    },
    getCaretPos: function () {
        var input = this.getInputDOMNode();
        var pos = 0;

        if ("selectionStart" in input) {
            pos = input.selectionStart;
        } else {
            var range = document.selection.createRange();
            var len = range.text.length;
            range.moveStart("character", -input.value.length);
            pos = range.text.length - len;
        }

        return pos;
    },
    setCaretPos: function (pos) {
        var input;
        var setPos = function () {
            if ("selectionStart" in input && "selectionEnd" in input) {
                input.selectionStart = input.selectionEnd = pos;
            } else if ("setSelectionRange" in input) {
                input.setSelectionRange(pos, pos);
            } else {
                var inputRange = input.createTextRange();
                inputRange.collapse(true);
                inputRange.moveStart("character", pos);
                inputRange.moveEnd("character", 0);
                inputRange.select();
            }
        };

        if (this.isMounted()) {
            input = this.getInputDOMNode();
            setPos();
            setTimeout(setPos, 0);
        }

        this.lastCaretPos = pos;
    },
    isFocused: function () {
        return document.activeElement === this.getInputDOMNode();
    },
    parseMask: function (mask) {
        var _this4 = this;

        if (typeof mask !== "string") {
            return {
                mask: null,
                permanents: []
            };
        }
        var str = "";
        var permanents = [];
        var isPermanent = false;

        mask.split("").forEach(function (char) {
            if (!isPermanent && char === "\\") {
                isPermanent = true;
            } else {
                if (isPermanent || !_this4.charsRules[char]) {
                    permanents.push(str.length);
                }
                str += char;
                isPermanent = false;
            }
        });

        return {
            mask: str,
            permanents: permanents
        };
    },
    getStringValue: function (value) {
        return !value && value !== 0 ? "" : value + "";
    },
    getInitialState: function () {
        var mask = this.parseMask(this.props.mask);
        var defaultValue = this.props.defaultValue != null ? this.props.defaultValue : null;
        var value = this.props.value != null ? this.props.value : defaultValue;

        value = this.getStringValue(value);

        var state = {
            mask: mask.mask,
            permanents: mask.permanents,
            maskChar: "maskChar" in this.props ? this.props.maskChar : this.defaultMaskChar
        };
        if (this.props.alwaysShowMask || value) {
            value = this.formatValue(value, state);
        }
        state.value = value;

        return state;
    },
    componentWillMount: function () {
        var _state = this.state;
        var mask = _state.mask;
        var value = _state.value;

        if (mask && value) {
            this.setState({ value: value });
        }
    },
    componentWillReceiveProps: function (nextProps) {
        var mask = this.parseMask(nextProps.mask);
        var maskChar = "maskChar" in nextProps ? nextProps.maskChar : this.defaultMaskChar;
        var state = {
            mask: mask.mask,
            permanents: mask.permanents,
            maskChar: maskChar
        };

        var newValue = nextProps.value !== undefined ? this.getStringValue(nextProps.value) : this.state.value;

        var isMaskChanged = mask.mask && mask.mask !== this.state.mask;
        var showEmpty = nextProps.alwaysShowMask || this.isFocused();
        if (isMaskChanged || mask.mask && (newValue || showEmpty)) {
            newValue = this.formatValue(newValue, state);
        }
        if (mask.mask && this.isEmpty(newValue, state) && !showEmpty) {
            newValue = "";
        }
        if (this.state.value !== newValue) {
            state.value = newValue;
        }
        this.setState(state);
    },
    componentDidUpdate: function (prevProps, prevState) {
        var mask = this.state.mask;
        if (!mask) {
            return;
        }
        var isMaskChanged = mask && mask !== prevState.mask;
        var pos = this.lastCaretPos;
        var filledLen = this.getFilledLength();
        if (isMaskChanged && filledLen < pos) {
            this.setCaretPos(this.getRightEditablePos(filledLen));
        }
    },
    onKeyDown: function (event) {
        var hasHandler = typeof this.props.onKeyDown === "function";
        if (event.ctrlKey || event.metaKey) {
            if (hasHandler) {
                this.props.onKeyDown(event);
            }
            return;
        }

        var caretPos = this.getCaretPos();
        var value = this.state.value;
        var key = event.key;
        var preventDefault = false;
        switch (key) {
            case "Backspace":
            case "Delete":
                var prefixLen = this.getPrefix().length;
                var deleteFromRight = key === "Delete";
                var selectionRange = this.getSelection();
                if (selectionRange.length) {
                    value = this.clearRange(value, selectionRange.start, selectionRange.length);
                } else if (caretPos < prefixLen || !deleteFromRight && caretPos === prefixLen) {
                    caretPos = prefixLen;
                } else {
                    var editablePos = deleteFromRight ? this.getRightEditablePos(caretPos) : this.getLeftEditablePos(caretPos - 1);
                    if (editablePos !== null) {
                        value = this.clearRange(value, editablePos, 1);
                        caretPos = editablePos;
                    }
                }
                preventDefault = true;
                break;
            default:
                break;
        }

        if (hasHandler) {
            this.props.onKeyDown(event);
        }

        if (value !== this.state.value) {
            event.target.value = value;
            this.setState({
                value: value
            });
            preventDefault = true;
            if (typeof this.props.onChange === "function") {
                this.props.onChange(event);
            }
        }
        if (preventDefault) {
            event.preventDefault();
            this.setCaretPos(caretPos);
        }
    },
    onKeyPress: function (event) {
        var key = event.key;
        var hasHandler = typeof this.props.onKeyPress === "function";
        if (key === "Enter" || event.ctrlKey || event.metaKey) {
            if (hasHandler) {
                this.props.onKeyPress(event);
            }
            return;
        }

        var caretPos = this.getCaretPos();
        var _state2 = this.state;
        var value = _state2.value;
        var mask = _state2.mask;
        var maskChar = _state2.maskChar;

        var maskLen = mask != null ? mask.length : 0;
        var prefixLen = this.getPrefix().length;

        if (this.isPermanentChar(caretPos) && mask[caretPos] === key) {
            value = this.insertRawSubstr(value, key, caretPos);
            ++caretPos;
        } else {
            var editablePos = this.getRightEditablePos(caretPos);
            if (editablePos !== null && this.isAllowedChar(key, editablePos)) {
                value = this.insertRawSubstr(value, key, caretPos);
                caretPos = editablePos + 1;
            }
        }

        if (value !== this.state.value) {
            event.target.value = value;
            this.setState({
                value: value
            });
            if (typeof this.props.onChange === "function") {
                this.props.onChange(event);
            }
        }
        event.preventDefault();
        while (caretPos > prefixLen && this.isPermanentChar(caretPos)) {
            ++caretPos;
        }
        this.setCaretPos(caretPos);
    },
    onChange: function (event) {
        var pasteSelection = this.pasteSelection;
        if (pasteSelection) {
            this.pasteSelection = null;
            this.pasteText(this.state.value, event.target.value, pasteSelection);
            return;
        }
        var caretPos = this.getCaretPos();
        var maskLen = this.state.mask != null ? this.state.mask.length : 0;
        var maskChar = this.state.maskChar;
        var target = event.target;
        var value = target.value;
        var valueLen = value.length;
        if (valueLen > maskLen) {
            value = value.substr(0, maskLen);
        } else if (maskChar && valueLen < maskLen) {
            var removedLen = maskLen - valueLen;
            value = this.clearRange(this.state.value, caretPos, removedLen);
        }
        target.value = this.formatValue(value);
        this.setState({
            value: target.value
        });

        this.setCaretPos(caretPos);

        if (typeof this.props.onChange === "function") {
            this.props.onChange(event);
        }
    },
    onFocus: function (event) {
        var maskLen = this.state.mask != null ? this.state.mask.length : 0;
        if (!this.state.value) {
            var prefix = this.getPrefix();
            var value = this.formatValue(prefix);
            event.target.value = this.formatValue(value);
            this.setState({
                value: value
            }, this.setCaretToEnd);

            if (typeof this.props.onChange === "function") {
                this.props.onChange(event);
            }
        } else if (this.getFilledLength() < maskLen) {
            this.setCaretToEnd();
        }

        if (typeof this.props.onFocus === "function") {
            this.props.onFocus(event);
        }
    },
    onBlur: function (event) {
        if (!this.props.alwaysShowMask && this.isEmpty(this.state.value)) {
            event.target.value = "";
            this.setState({
                value: ""
            });
            if (typeof this.props.onChange === "function") {
                this.props.onChange(event);
            }
        }

        if (typeof this.props.onBlur === "function") {
            this.props.onBlur(event);
        }
    },
    onPaste: function (event) {
        if (this.isAndroidBrowser()) {
            this.pasteSelection = this.getSelection();
            event.target.value = "";
            return;
        }
        var text;
        if (window.clipboardData && window.clipboardData.getData) {
            // IE
            text = window.clipboardData.getData("Text");
        } else if (event.clipboardData && event.clipboardData.getData) {
            text = event.clipboardData.getData("text/plain");
        }
        if (text) {
            var value = this.state.value;
            var selection = this.getSelection();
            this.pasteText(value, text, selection);
        }
        event.preventDefault();
    },
    pasteText: function (value, text, selection) {
        var caretPos = selection.start;
        if (selection.length) {
            value = this.clearRange(value, caretPos, selection.length);
        }
        var textLen = this.getRawSubstrLength(value, text, caretPos);
        var value = this.insertRawSubstr(value, text, caretPos);
        caretPos += textLen;
        caretPos = this.getRightEditablePos(caretPos) || caretPos;
        if (value !== this.getInputDOMNode().value) {
            event.target.value = value;
            this.setState({
                value: value
            });
            if (typeof this.props.onChange === "function") {
                this.props.onChange(event);
            }
        }
        this.setCaretPos(caretPos);
    },
    render: function () {
        var _this5 = this;

        var ourProps = {};
        if (this.state.mask) {
            var handlersKeys = ["onFocus", "onBlur", "onChange", "onKeyDown", "onKeyPress", "onPaste"];
            handlersKeys.forEach(function (key) {
                ourProps[key] = _this5[key];
            });
            ourProps.value = this.state.value;
        }
        return React.createElement("input", _extends({ ref: "input" }, this.props, ourProps));
    }
});

var InputGroup = React.createClass({displayName: "InputGroup",
    getInitialState: function(){
        var childs = [];
        React.Children.forEach(this.props.children, function(children){
            childs.push(children);
        });

        return {
            childs: childs
        };
    },
    componentWillReceiveProps: function(nextProps){
        if (this.props.children !== nextProps.children){
            var childs = [];
            React.Children.forEach(nextProps.children, function(children){
                childs.push(children);
            });

            this.setState({childs: childs});
        }
    },
    render: function(){
        var childs = this.state.childs;
        var childIndex = 0;
        var elementIndex = 0;
        var glue = this.props.glue;

        var content = [];

        while (childIndex < childs.length){
            var child = childs[childIndex++];
            child.key = elementIndex++;
            content.push(child);
            if (glue && childIndex < childs.length){
                content.push(
                    React.createElement("span", {key: elementIndex++, className: "input-group__glue"}, glue)
                );
            }
        }

        return (
            React.createElement("div", {className: "input-group"},
                content
            )
        );
    }
});
var Popup = React.createClass({displayName: "Popup",
    componentDidMount: function() {
        $(document).on("keydown", this.onDocumentKeyDown);
    },
    componentWillUnmount: function() {
        $(document).off("keydown", this.onDocumentKeyDown);
    },
    onDocumentKeyDown: function(event) {
        if (event.keyCode === 27) {
            this.onHide();
        }
    },
    onContainerClick: function(event) {
        var $target = $(event.target);
        if ($target.is(this.refs.container.getDOMNode())) {
            this.onHide();
        }
    },
    onHide: function() {
        if (_.isFunction(this.props.onHide)) {
            this.props.onHide();
        }
    },
    render: function() {
        return (
            React.createElement(React.addons.CSSTransitionGroup, {transitionName: "popup-container", transitionEnterTimeout: 300, transitionLeaveTimeout: 300},
                 this.props.visible && React.createElement(PopupContainer, {ref: "container", onClick: this.onContainerClick, onHideEnd: this.props.onHideEnd, className: this.props.className, style: this.props.style, key: "1"}, this.props.children)
            )
        );
    }
});

var PopupContainer = React.createClass({displayName: "PopupContainer",
    componentWillUnmount: function() {
        if (_.isFunction(this.props.onHideEnd)) {
            this.props.onHideEnd();
        }
    },
    render: function() {
        return (
            React.createElement("div", {className: "popup-container", onClick: this.props.onClick, key: "1"},
                React.createElement("div", {className: ("popup " + (this.props.className || "")), style: this.props.style},
                    this.props.children
                )
            )
        );
    }
});

var RadioButton = React.createClass({displayName: "RadioButton",
    onClick: function(){
        if (this.props.inRadioButtonGroup){
            this.props.onClick(this._currentElement, this.props._onClick);
        }
        else {
            this.props.onClick();
        }
    },
    render: function(){
        var cx = React.addons.classSet;
        var radioButtonClasses = cx({
            'radio-button': true,
            'radio-button--checked': this.props.checked
        });
        return (
            React.createElement("div", {className: radioButtonClasses + " " + (this.props.className ? this.props.className : ""), onClick: this.onClick},
                React.createElement("div", {className: "radio-button__icon"}),
                React.createElement("label", {className: "radio-button__label"}, this.props.label)
            )
        );
    }
});
var RadioButtonGroup = React.createClass({displayName: "RadioButtonGroup",
    getInitialState: function(){
        return {
            checkedButton: null
        };
    },
    onClick: function(child, onClick){
        this.setState({checkedButton: child});
        onClick();
    },
    render: function(){
        var that = this;
        var processChild = function(child){
            if (_.isArray(child)){
                return React.Children.map(child, processChild);
            }
            if (child.type.displayName === "RadioButton"){
                if (child.props.onClick){
                    child.props._onClick = child.props.onClick;
                    child.props.onClick = that.onClick;
                }
                child.props.checked = that.state.checkedButton === child;
                child.props.inRadioButtonGroup = true;
            }
            var children = child.props.children;
            if (children){
                if (_.isArray(children)){
                    React.Children.map(children, processChild);
                }
                else {
                    processChild(children);
                }
            }
        };

        processChild(this.props.children);

        return (
            React.createElement("div", {className: "radio-button-group"},
                this.props.children
            )
        );
    }
});
var Textarea = React.createClass({displayName: "Textarea",
    HIDDEN_TEXTAREA_STYLE: ("\n        min-height:none !important;\n        max-height:none !important;\n        height:0 !important;\n        visibility:hidden !important;\n        overflow:hidden !important;\n        position:absolute !important;\n        z-index:-1000 !important;\n        top:0 !important;\n        right:0 !important\n    "









),

    SIZING_STYLE: [
        'letter-spacing',
        'line-height',
        'padding-top',
        'padding-bottom',
        'font-family',
        'font-weight',
        'font-size',
        'text-rendering',
        'text-transform',
        'width',
        'padding-left',
        'padding-right',
        'border-width',
        'box-sizing'
    ],

    computedStyleCache: {},
    hiddenTextarea: undefined,

    getComputedStyle: (function () {
        var Push = Array.prototype.push;

        function getComputedStylePixel(element, property, fontSize) {
            var
            value = element.currentStyle[property].match(/([\d\.]+)(%|cm|em|in|mm|pc|pt|)/) || [0, 0, ''],
            size = value[1],
            suffix = value[2],
            rootSize;

            fontSize = fontSize != null ? fontSize : /%|em/.test(suffix) && element.parentElement ? getComputedStylePixel(element.parentElement, 'fontSize', null) : 16;
            rootSize = property == 'fontSize' ? fontSize : /width/i.test(property) ? element.clientWidth : element.clientHeight;

            return suffix == '%' ? size / 100 * rootSize :
                   suffix == 'cm' ? size * 0.3937 * 96 :
                   suffix == 'em' ? size * fontSize :
                   suffix == 'in' ? size * 96 :
                   suffix == 'mm' ? size * 0.3937 * 96 / 10 :
                   suffix == 'pc' ? size * 12 * 96 / 72 :
                   suffix == 'pt' ? size * 96 / 72 :
                   size;
        }

        function setShortStyleProperty(style, property) {
            var
            borderSuffix = property == 'border' ? 'Width' : '',
            t = property + 'Top' + borderSuffix,
            r = property + 'Right' + borderSuffix,
            b = property + 'Bottom' + borderSuffix,
            l = property + 'Left' + borderSuffix;

            style[property] = (style[t] == style[r] && style[t] == style[b] && style[t] == style[l] ? [ style[t] ] :
                               style[t] == style[b] && style[l] == style[r] ? [ style[t], style[r] ] :
                               style[l] == style[r] ? [ style[t], style[r], style[b] ] :
                               [ style[t], style[r], style[b], style[l] ]).join(' ');
        }
        // tobi: we can not use native CSSStyleDeclaration ?
        function CSSStyleDeclaration(element) {
            var
            style = this,
            currentStyle = element.currentStyle,
            fontSize = getComputedStylePixel(element, 'fontSize');

            for (property in currentStyle) {
                Push.call(style, property == 'styleFloat' ? 'float' : property.replace(/[A-Z]/, function (match) {
                    return '-' + match.toLowerCase();
                }));

                if (property == 'width') style[property] = element.offsetWidth + 'px';
                else if (property == 'height') style[property] = element.offsetHeight + 'px';
                else if (property == 'styleFloat') style['float'] = currentStyle[property];
                else if (/margin.|padding.|border.+W/.test(property) && style[property] != 'auto') style[property] = Math.round(getComputedStylePixel(element, property, fontSize)) + 'px';
                else style[property] = currentStyle[property];
            }

            setShortStyleProperty(style, 'margin');
            setShortStyleProperty(style, 'padding');
            setShortStyleProperty(style, 'border');

            style.fontSize = Math.round(fontSize) + 'px';
        }

        CSSStyleDeclaration.prototype = {
            constructor: CSSStyleDeclaration,
            getPropertyPriority: function () {
                throw Error('NotSupportedError: DOM Exception 9');
            },
            getPropertyValue: function (property) {
                return this[property.replace(/-\w/g, function (match) {
                    return match[1].toUpperCase();
                })];
            },
            item: function (index) {
                return this[index];
            },
            removeProperty: function () {
                throw Error('NoModificationAllowedError: DOM Exception 7');
            },
            setProperty: function () {
                throw Error('NoModificationAllowedError: DOM Exception 7');
            },
            getPropertyCSSValue: function () {
                throw Error('NotSupportedError: DOM Exception 9');
            }
        };

        return function (element) {
            return new CSSStyleDeclaration(element);
        };
    })(),
    getHiddenHeight: function(cb) {
        if (window.getComputedStyle) {
            height = this.hiddenTextarea.scrollHeight;
            cb(height);
        }
        else {
            setImmediate(function()  {
                height = this.hiddenTextarea.scrollHeight;
                cb(height);
            }.bind(this));
        }
    },
    calculateNodeHeight: function(uiTextNode,
            useCache,
            minRows, maxRows, cb) {
        if (minRows === undefined) {
            minRows = null;
        }
        if (maxRows === undefined) {
            maxRows = null;
        }
        if (!this.hiddenTextarea) {
            this.hiddenTextarea = document.createElement('textarea');
            document.body.appendChild(this.hiddenTextarea);
        }

        // Copy all CSS properties that have an impact on the height of the content in
        // the textbox
        var $__0=


          this.calculateNodeStyling(uiTextNode, useCache),paddingSize=$__0.paddingSize,borderSize=$__0.borderSize,boxSizing=$__0.boxSizing,sizingStyle=$__0.sizingStyle;

        // Need to have the overflow attribute to hide the scrollbar otherwise
        // text-lines will not calculated properly as the shadow will technically be
        // narrower for content
        this.hiddenTextarea.setAttribute('style', sizingStyle + ';' + this.HIDDEN_TEXTAREA_STYLE);
        this.hiddenTextarea.value = uiTextNode.value || uiTextNode.placeholder || '';

        var minHeight = -Infinity;
        var maxHeight = Infinity;
        this.getHiddenHeight(function(height)  {

            if (boxSizing === 'border-box') {
                // border-box: add border, since height = content + padding + border
                height = height + borderSize;
            } else if (boxSizing === 'content-box') {
                // remove padding, since height = content
                height = height - paddingSize;
            }

            if (minRows !== null || maxRows !== null) {
                // measure height of a textarea with a single row
                this.hiddenTextarea.value = '';
                var singleRowHeight = this.hiddenTextarea.scrollHeight - paddingSize;
                if (minRows !== null) {
                    minHeight = singleRowHeight * minRows;
                    if (boxSizing === 'border-box') {
                        minHeight = minHeight + paddingSize + borderSize;
                    }
                    height = Math.max(minHeight, height);
                }
                if (maxRows !== null) {
                    maxHeight = singleRowHeight * maxRows;
                    if (boxSizing === 'border-box') {
                        maxHeight = maxHeight + paddingSize + borderSize;
                    }
                    height = Math.min(maxHeight, height);
                }
            }
            cb.call(this, {height:height, minHeight:minHeight, maxHeight:maxHeight});
        }.bind(this));
    },
    calculateNodeStyling: function(node, useCache) {
        var nodeRef = (
            node.getAttribute('id') ||
            node.getAttribute('data-reactid') ||
            node.getAttribute('name')
        );

        if (useCache && this.computedStyleCache[nodeRef]) {
            return this.computedStyleCache[nodeRef];
        }

        var style = (window.getComputedStyle || this.getComputedStyle)(node);

        var boxSizing = (
            style.getPropertyValue('box-sizing') ||
            style.getPropertyValue('-moz-box-sizing') ||
            style.getPropertyValue('-webkit-box-sizing')
        );

        var paddingSize = (
            parseFloat(style.getPropertyValue('padding-bottom')) +
            parseFloat(style.getPropertyValue('padding-top'))
        );

        var borderSize = (
            parseFloat(style.getPropertyValue('border-bottom-width')) +
            parseFloat(style.getPropertyValue('border-top-width'))
        );

        var sizingStyle = this.SIZING_STYLE
            .map(function(name)  {return (name + ":" + style.getPropertyValue(name));})
            .join(';');

        var nodeInfo = {
            sizingStyle:sizingStyle,
            paddingSize:paddingSize,
            borderSize:borderSize,
            boxSizing:boxSizing
        };

        if (useCache && nodeRef) {
            this.computedStyleCache[nodeRef] = nodeInfo;
        }

        return nodeInfo;
    },
    _resizeComponent:function() {
        var $__0=  this.props,useCacheForDOMMeasurements=$__0.useCacheForDOMMeasurements;
        this.calculateNodeHeight(
            this.refs.textarea.getDOMNode(),
            useCacheForDOMMeasurements,
            this.props.rows || this.props.minRows,
            this.props.maxRows,
            this.setState);
    },
    getInitialState: function() {
        return {
           focus: false,
           maxLength: this.props.maxLength,
           scrollable: false,
           value: this.props.value || ""
        };
    },
    componentDidMount: function() {
        this._resizeComponent();
        var $textarea = $(this.refs.textarea.getDOMNode());
        $textarea.on("focus", function() {});
        $textarea.on("blur", function() {});
        var $container = $(this.refs.container.getDOMNode());
        this.setState({
            paddingLeft: parseInt($container.css("padding-left")) + 1
        });
    },
    componentDidUpdate: function(prevProps, prevState) {
        if (prevState.value !== this.state.value) {
            this._resizeComponent();
        }
    },
    componentWillReceiveProps: function(nextProps) {
        this.setState({
            value: nextProps.value || ""
        });
    },
    onFocus: function() {
        this.setState({focus: true});
    },
    onBlur: function() {
        this.setState({focus: false});
        if (this.props.onBlur) {
            this.props.onBlur();
        }
    },
    onChange: function(event) {
        if (this.state.acceptedChars) {
            var input = event.target;
            var cursorPos = this.getInputCursorPosition(input);
            event.target.value = this.state.acceptedChars.replace(event.target.value);
            input.setSelectionRange(cursorPos, cursorPos);
        }
        if (!this.props.autosize && event.target.scrollHeight > event.target.clientHeight) {
            if (!this.state.scrollable) {
                this.setState({
                    scrollable: true
                });
            }
        }
        else if (this.state.scrollable) {
            this.setState({
                scrollable: false
            });
        }
        if (this.props.onChange) {
            this.props.onChange(event.target.value, event);
        }
        else {
            this.setState({
                value: event.target.value
            });
        }
        this._resizeComponent();
    },
    onClick: function() {
        this.refs.textarea.getDOMNode().focus();
    },
    render: function() {
        var cx = React.addons.classSet;
        var inputClasses = cx({
            "input": true,
            "input--textarea": true,
            "input--focus": this.state.focus,
            "input--label-right": this.props.labelRight,
            "input--label-light": this.props.labelLight,
            "input--nolabel": !this.props.label,
            "input--invalid": this.props.invalid,
            "input--disabled": this.props.disabled
        });
        var titleClasses = cx({
            "input__title": true
        });
        var value = this.state.value;
        var showPlaceholder = !!this.props.placeholder && !value;
        var style = {};
        if (this.props.autosize) {
            style = {
                height: this.state.height,
                overflow: "hidden",
                paddingRight: 0
            };
        }
        return (
            React.createElement("div", {onClick: this.onClick, className: inputClasses + " " + (this.props.className ? this.props.className : "")},
                 !!this.props.label &&
                    React.createElement("label", {className: titleClasses},
                        this.props.label
                    ),

                 showPlaceholder && React.createElement("div", {ref: "placeholder", className: "input__placeholder input__placeholder--textarea", style: {paddingLeft: this.state.paddingLeft}}, this.props.placeholder),
                React.createElement("div", {ref: "container", className: "input__textarea-container"},
                    React.createElement("textarea", {ref: "textarea", style: style, onFocus: this.onFocus, onBlur: this.onBlur, onChange: this.onChange, maxLength: this.props.maxLength, value: value}),
                     this.state.scrollable && React.createElement(TextareaScrollbar, {textarea: this.refs.textarea})
                )
            )
        );
    }
});

var TextareaScrollbar = React.createClass({displayName: "TextareaScrollbar",
    getDimensions: function(props) {
        props = props || this.props;
        var textarea = this.props.textarea.getDOMNode();
        var $__0=     textarea,clientHeight=$__0.clientHeight,scrollHeight=$__0.scrollHeight;
        var isMounted = this.isMounted();
        var scrollbarHeight = isMounted ? $(this.getDOMNode()).height() : 0;
        var lineHeight = Math.max((clientHeight / scrollHeight) * scrollbarHeight, 20);
        return {
            clientHeight: clientHeight,
            scrollHeight: scrollHeight,
            scrollbarHeight: scrollbarHeight,
            lineHeight: lineHeight,
            maxScroll: scrollHeight - clientHeight,
            scrollRatio: (scrollHeight - clientHeight) / (scrollbarHeight - lineHeight)
        };
    },
    getInitialState: function() {
        return _.extend({
            scrollTop: this.props.scrollTop,
            height: 0,
            scrollbarHeight: 0
        }, this.getDimensions());
    },
    componentWillReceiveProps: function(nextProps) {
        this.setState(this.getDimensions(nextProps));
    },
    componentDidMount: function() {
        var textarea = this.props.textarea.getDOMNode();
        var $textarea = $(textarea);
        $textarea.unbind("scroll", this.onScroll)
        .bind("scroll", this.onScroll);

        this.setState(this.getDimensions());
    },
    componentWillUnmount: function() {
        if (this.props.textarea.isMounted()) {
            var $textarea = $(this.props.textarea.getDOMNode());
            $textarea.unbind("scroll", this.onScroll);
        }
    },
    onScroll: function(event) {
        if (!this.state.active) {
            this.setState({
                scrollTop: event.target.scrollTop
            });
        }
    },
    onMouseDown: function(event) {
        this.setState({
            y: event.clientY,
            startScrollTop: this.props.textarea.getDOMNode().scrollTop,
            active: true
        });
        $(document).unbind("mousemove", this.onMouseMove);
        $(document).unbind("mouseup", this.onMouseUp);
        $(document).bind("mousemove", this.onMouseMove);
        $(document).bind("mouseup", this.onMouseUp);
        event.preventDefault();
    },
    onMouseMove: function(event) {
        var y = event.clientY;
        var textarea = this.props.textarea.getDOMNode();
        var scrollRatio = this.state.scrollRatio;
        var scrollTop = (this.state.startScrollTop + (y - this.state.y) * scrollRatio);
        var newState = {};
        if (scrollTop <= 0) {
            scrollTop = 0;
        }
        else if (scrollTop >= this.state.maxScroll) {
            scrollTop = this.state.maxScroll;
        }
        this.props.textarea.getDOMNode().scrollTop = scrollTop;
        newState.scrollTop = scrollTop;
        this.setState(newState);
        event.preventDefault();
    },
    onMouseUp: function() {
        $(document).unbind("mousemove", this.onMouseMove);
        $(document).unbind("mouseup", this.onMouseUp);
        this.setState({active: false});
    },
    render: function() {
        var cx = React.addons.classSet;
        var classes = cx({
            "input__scrollbar": true,
            "input__scrollbar--active": this.state.active
        });
        var style = {
            top: this.state.scrollTop / this.state.scrollRatio + "px",
            height: this.state.lineHeight
        };
        return (
            React.createElement("div", {className: classes},
                React.createElement("div", {style: style, className: "input__scrollbar-line", onMouseDown: this.onMouseDown})
            )
        );
    }
});