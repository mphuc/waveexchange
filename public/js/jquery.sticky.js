!function(t){var e={topSpacing:0,bottomSpacing:0,className:"is-sticky",wrapperClassName:"sticky-wrapper",center:!1,getWidthFrom:""},i=t(window),n=t(document),o=[],s=i.height(),r=function(){for(var e=i.scrollTop(),r=n.height(),a=r-s,c=e>a?a-e:0,p=0;p<o.length;p++){var l=o[p];if(e<=l.stickyWrapper.offset().top-l.topSpacing-c)null!==l.currentTop&&(l.stickyElement.css("position","").css("top",""),l.stickyElement.parent().removeClass(l.className),l.currentTop=null);else{var d=r-l.stickyElement.outerHeight()-l.topSpacing-l.bottomSpacing-e-c;d<0?d+=l.topSpacing:d=l.topSpacing,l.currentTop!=d&&(l.stickyElement.css("position","fixed").css("top",d),void 0!==l.getWidthFrom&&l.stickyElement.css("width",t(l.getWidthFrom).width()),l.stickyElement.parent().addClass(l.className),l.currentTop=d)}}},a=function(){s=i.height()},c={init:function(i){var n=t.extend({},e,i);return this.each(function(){var e=t(this),i=e.attr("id"),s=t("<div></div>").attr("id",i+"-sticky-wrapper").addClass(n.wrapperClassName);e.wrapAll(s),n.center&&e.parent().css({width:e.outerWidth(),marginLeft:"auto",marginRight:"auto"}),"right"==e.css("float")&&e.css({float:"none"}).parent().css({float:"right"});var r=e.parent();r.css("height",e.outerHeight()),o.push({topSpacing:n.topSpacing,bottomSpacing:n.bottomSpacing,stickyElement:e,currentTop:null,stickyWrapper:r,className:n.className,getWidthFrom:n.getWidthFrom})})},update:r,unstick:function(e){return this.each(function(){for(var e=t(this),i=-1,n=0;n<o.length;n++)o[n].stickyElement.get(0)==e.get(0)&&(i=n);-1!=i&&(o.splice(i,1),e.unwrap(),e.removeAttr("style"))})}};window.addEventListener?(window.addEventListener("scroll",r,!1),window.addEventListener("resize",a,!1)):window.attachEvent&&(window.attachEvent("onscroll",r),window.attachEvent("onresize",a)),t.fn.sticky=function(e){return c[e]?c[e].apply(this,Array.prototype.slice.call(arguments,1)):"object"!=typeof e&&e?void t.error("Method "+e+" does not exist on jQuery.sticky"):c.init.apply(this,arguments)},t.fn.unstick=function(e){return c[e]?c[e].apply(this,Array.prototype.slice.call(arguments,1)):"object"!=typeof e&&e?void t.error("Method "+e+" does not exist on jQuery.sticky"):c.unstick.apply(this,arguments)},t(function(){setTimeout(r,0)})}(jQuery);