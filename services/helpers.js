'use strict'
const moment = require('moment');
var register = function(Handlebars) {
  var helpers = {
    if_eq: function(a, b, opts){
        if (a == b) {
        	return opts.fn(this);
	    } else {
	        return opts.inverse(this);
	    }
    },
    prettifyDate: function(timestamp) {
        return moment(timestamp).format('MM/DD/YYYY LT')

    },
    prettifyDates: function(timestamp) {
        return moment(timestamp).format('MM/DD/YYYY')

    },

    satoshi: function(amount) {
        return (parseFloat(amount)/100000000).toFixed(8);

    },

    inc: function (value, options) {
          return parseInt(value) + 1;
    },
    option: function(value) {
      var selected = value.toLowerCase() === (this.toString()).toLowerCase() ? 'selected="selected"' : '';
      return '<option value="' + this + '" ' + selected + '>' + this + '</option>';
    },
    formatDate: function (date, format) {
        return moment(date).format(format);
    },

    div: function (num1) {
        return (num1/30000).toFixed(2)
      },
    timeAgo: function(date) {
      return timeago(date);
    },

    JSON: function(obj) {
      return JSON.stringify(obj,null,2);
    },
    Upper: function(str) {
      return str.charAt(0).toUpperCase() + str.slice(1);
    },
    money: function(num) {
      var p = parseFloat(num/100).toFixed(2).split(".");
      return p[0].split("").reverse().reduce(function(acc, num, i, orig) {
          return  num=="-" ? acc : num + (i && !(i % 3) ? "," : "") + acc;
      }, "") + "." + p[1];
    }

  };

  if (Handlebars && typeof Handlebars.registerHelper === "function") {
    // register helpers
    for (var prop in helpers) {
        Handlebars.registerHelper(prop, helpers[prop]);
    }
  } else {
      // just return helpers object if we can't register helpers here
      return helpers;
  }

};

module.exports.register = register;
module.exports.helpers = register(null); 

