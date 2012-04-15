if (!Function.prototype.bind) {  
  Function.prototype.bind = function (oThis) {  
    if (typeof this !== "function") {  
      // closest thing possible to the ECMAScript 5 internal IsCallable function  
      throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");  
    }  
  
    var aArgs = Array.prototype.slice.call(arguments, 1),   
        fToBind = this,   
        fNOP = function () {},  
        fBound = function () {  
          return fToBind.apply(this instanceof fNOP  
                                 ? this  
                                 : oThis || window,  
                               aArgs.concat(Array.prototype.slice.call(arguments)));  
        };  
  
    fNOP.prototype = this.prototype;  
    fBound.prototype = new fNOP();  
  
    return fBound;  
  };  
}

/**
 * Provides requestAnimationFrame in a cross browser way.
 * http://paulirish.com/2011/requestanimationframe-for-smart-animating/
 */

if ( !window.requestAnimationFrame ) {

	window.requestAnimationFrame = ( function() {

		return window.webkitRequestAnimationFrame ||
		window.mozRequestAnimationFrame ||
		window.oRequestAnimationFrame ||
		window.msRequestAnimationFrame ||
		function( /* function FrameRequestCallback */ callback, /* DOMElement Element */ element ) {

			window.setTimeout( callback, 1000 / 60 );

		};

	} )();

}

function Intrael(uri,sse){
    this._dtlisteners = [];
    this._erlisteners = [];
    this.uri = uri ? uri : "http://127.0.0.1:6661";
    this.query = null;
    this.extra = "";
    this.uniq = Date.now();
	this.sse = sse ? true : false;
}

Intrael.prototype = {

    constructor: Intrael,

    addListener: function(type, listener){
        switch(type){
			case 'data':
				this._dtlisteners.push(listener);
				break;
			case 'error':
				this._erlisteners.push(listener);
				break;		
			default: throw new Error("Only 'data' and 'error' event types supported");
		}
    },

    fire: function(event){
        if (typeof event == "string"){
            event = { type: event, blobs:[],header:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] };
        }
        if (!event.target){
            event.target = this;
        }

        if (!event.type){  
            throw new Error("Event object missing 'type' property.");
        }
		switch(event.type){
			case 'data':
				var listeners = this._dtlisteners;
				break;
			case 'error':
				var listeners = this._erlisteners;
				break;
			default: throw new Error("Only 'data' and 'error' event types supported");
		}
        for (var i=0, len=listeners.length; i != len; i++) listeners[i].call(this, event);       
    },

    removeListener: function(type, listener){
		switch(type){
			case 'data':
				var listeners = this._dtlisteners;
				break;
			case 'error':
				var listeners = this._erlisteners;
				break;		
			default: throw new Error("Only 'data' and 'error' event types supported");
		}
		for (var i=0, len=listeners.length; i < len; i++){
			if (listeners[i] === listener){
				listeners.splice(i, 1);
				break;
			}
		}
    },
    
    start : function(){
		if(this.sse){
			this.evs = new EventSource(this.uri+this.uniq);
			this.evs.onmessage = this._processSSE.bind(this);
			this.evs.onerror = this._error.bind(this);
			if (window.XDomainRequest) {
				this.xhr = new XDomainRequest();
			} else {
				this.xhr = new XMLHttpRequest();
			}
		}else{
			if (window.XDomainRequest) {
				this.xhr = new XDomainRequest();
				this.xhr.onerror = this._error.bind(this);
				this.xhr.onload = this._processXHR.bind(this);
			} else {
				this.xhr = new XMLHttpRequest();
				this.xhr.onreadystatechange = this._processXHR.bind(this);
			}
			this._get();
		}	
	},
	_get : function(){
		this.xhr.abort();
		if(this.query){
			var opt=[];
			for(var i in this.query) opt.push( i+"="+this.query[i]);
			this.extra = "?"+opt.join("&");
		}
        this.xhr.open("GET", this.uri+"/00"+this.uniq+this.extra);
        this.extra="";
		this.xhr.send(null);	
	},

	stop : function(){
		if(this.evs){
			this.evs.close();
			delete this.evs;
		}
		if(this.xhr){
			this.xhr.abort();
			delete this.xhr;
		}
	},
	
	_error:function(){
		this.fire("error");
	},
	
	_processXHR : function(){
		if (this.xhr.readyState == 4) {
            if (this.xhr.status != 200) {
                this.fire("error");
            } else {
                var raw = JSON.parse(this.xhr.responseText);
				var data = this._parse(raw);
				data.type='data';
				this.fire(data);
                this._get();
            }
		}
	},

	_processSSE : function(e){
		var raw = JSON.parse(e.data);
		var data = this._parse(raw);
		data.type = 'data';
        this.fire(data);
        if(this.query){
			var extra="";
			var opt=[];
			for(var i in this.query) opt.push( i+"="+this.query[i]);
			extra = "?"+opt.join("&");
			this.xhr.open("GET", this.uri+this.id+extra);
			this.xhr.send(null);
			delete this.query;
		}
	},

	_parse: function(data){
		var blobs=[],joints=null;
		var labels = ["center","left","right","top","bottom","near","far"];
		var jlabels = ["rightelbow","leftelbow","rightshoulder","leftshoulder","righthand","lefthand","head"];
		var imax=data.length;
		var i=16;
		var hasJoints;
		while(i!=imax){
			var blob={},joints={};
			hasJoints=0;
			while(data[i]<0){
				joints[jlabels[7+data[i]]]={'x':data[i+1],'y':data[i+2],'z':data[i+3],'sx':data[i+4],'sy':data[i+5],'d':data[i+6]};
				i+=7;
				hasJoints=1;
			}
			if(hasJoints) blob.joints = joints; else delete joints;
			if(i!=imax){
				blob.px=data[i+28];
				blob.rs=data[i+29];
				blob.vr=data[i+30];
				blob.dt=data[i+31];
				for(var j=0,k=0;j != 28;j+= 4,k++){
					blob[labels[k]] = {'x':data[i+j],'y':data[i+j+1],'z':data[i+j+2],'d':data[i+j+3]};	
				}
			}
			blobs.push(blob);
		}
		return {'blobs':blobs,'header':{'time':data[0],'last':data[1],'ext':data[2],'skel':data[3],'left':data[4],'right':data[5],'top':data[6],'bottom':data[7],'near':data[8],'far':data[9],'min':data[10],'max':data[11],'ax':data[12],'ay':data[13],'az':data[14],'motor':data[15]}};
	}
};