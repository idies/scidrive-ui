function login(vospace, component, openWindow) {
    require(["dojo/_base/json", "my/OAuth"], function(dojo, OAuth){

    	var config = { consumer: {key: "sclient", secret: "ssecret"}};
        function success_reload(data) {
            var request_tokens = data.split("&");
            var reqToken = request_tokens[0].slice("oauth_token=".length);
            var tokenSecret = request_tokens[1].slice("oauth_token_secret=".length);

    		vospace.credentials = {
    			stage:"request",
				sig_method: 'HMAC-SHA1',
				consumer: {
					key: 'sclient',
					secret: 'ssecret'
				},
				token: {
	            	key: reqToken,
	            	secret: tokenSecret
		        }
			};

        	var identity = dojo.fromJson(localStorage.getItem('vospace_oauth_s'));

			identity.regions[vospace.id] = vospace.credentials;

            localStorage.setItem('vospace_oauth_s', dojo.toJson(identity));

            var authorizeUrl = vospace.url+"/authorize?provider=vao&action=initiate&oauth_token="+reqToken;
            authorizeUrl += "&oauth_callback="+document.location.href.slice(0,document.location.href.lastIndexOf('/')+1);
            if(vospace.isShare) {
            	authorizeUrl += "&share="+vospace.id;
            }
            document.location.href = authorizeUrl;
        }
        
        function success_open_window(data) {
		    require(["dojo/dom-construct", "dijit/Dialog", "dojo/_base/connect"], function(domConstruct, Dialog, connect){
	            var request_tokens = data.split("&");
	            var reqToken = request_tokens[0].slice("oauth_token=".length);
	            var tokenSecret = request_tokens[1].slice("oauth_token_secret=".length);

	        	if(dijit.byId('formDialog') != undefined){
	        		dijit.byId('formDialog').destroyRecursive();
	        	}

	    		var div = domConstruct.create("div", {
	    				innerHTML: "Please authenticate at <a href='"+
	    				vospace.url+"/authorize?provider=vao&action=initiate&oauth_token="+
	    				reqToken+"' target='_blanc'>VAO</a> and click ",
	    				align: "center"
	    			});

	    		var button = new dijit.form.Button({
	    			label: 'Done',
	    			onClick: function () {
	    	    		vospace.credentials = {
	    	    			stage: "request",
		    				sig_method: 'HMAC-SHA1',
		    				consumer: {
		    					key: 'sclient',
		    					secret: 'ssecret'
		    				},
		    				token: {
				            	key: reqToken,
				            	secret: tokenSecret
		    		        }
		    			};
			        	var identity = dojo.fromJson(localStorage.getItem('vospace_oauth_s'));
						identity.regions[vospace.id] = vospace.credentials;
			            localStorage.setItem('vospace_oauth_s', dojo.toJson(identity));

	    				dijit.byId('formDialog').hide();
	    	        	login2(vospace, component);
	    			}
	    		});
	    		div.appendChild(button.domNode);

	    		var loginDialog = new dijit.Dialog({
	    			id: 'formDialog',
	    			title: "Authentication",
	    			style: {width: "300px"},
	    			content: div
	    		});
	        	dijit.byId('formDialog').show();
	        });
        }


        function failure(data, ioargs) { console.error('Something bad happened: ' + ioargs.xhr); }

		var xhrArgs = {
		    url: vospace.url+'/request_token'+((vospace.isShare)?"?share="+vospace.id:""),
		    handleAs: "text",
		    preventCache: false,
		    load: (openWindow?success_open_window:success_reload),
		    error: failure
		};
		var args = OAuth.sign("GET", xhrArgs, config);
		dojo.xhrGet(args);
    });

}

function login2(vospace, component) {
    require(["dojo/_base/json", "my/OAuth", "my/VoboxPanel"], function(dojo, OAuth, VoboxPanel){
    	var url = vospace.url+"/access_token";

	    dojo.xhrPost(OAuth.sign("POST", {
	    	url: url,
	        handleAs: "text",
	        sync: false,
	        load: function(data) {
	        	var request_tokens = data.split("&");
	        	var token = request_tokens[0].slice("oauth_token=".length), tokenSecret = request_tokens[1].slice("oauth_token_secret=".length);

	            vospace.credentials.token = {
                	key: token,
                	secret: tokenSecret
                };
	            vospace.credentials.stage = "access";

	        	var identity = dojo.fromJson(localStorage.getItem('vospace_oauth_s'));
				identity.regions[vospace.id] = vospace.credentials;
	            localStorage.setItem('vospace_oauth_s', dojo.toJson(identity));

	            if(undefined == dijit.byId("voboxWidget")) {
		            new VoboxPanel({
		            	id: "voboxWidget",
		            	style: {height: '100%'}
		            }, dojo.byId("voboxWidgetDiv"));
	            }

	            dijit.byId("voboxWidget").loginToVO(vospace, component); // with updated credentials
            	dijit.byId("voboxWidget").startup();
	        },
	        error: function(error, data) {
	        	console.error(error);
				vospace.credentials = null;


	        	var identity = dojo.fromJson(localStorage.getItem('vospace_oauth_s'));
				delete identity.regions[vospace.id];
				localStorage.setItem('vospace_oauth_s', dojo.toJson(identity));

	            //login(vospace, null);
	        }
	    },vospace.credentials));
    });

}

function logout(vospace, component) {
	var identity = dojo.fromJson(localStorage.getItem('vospace_oauth_s'));
	delete identity.regions[vospace.id];
	localStorage.setItem('vospace_oauth_s', dojo.toJson(identity));

	delete vospace.credentials;

	if(vospace.isShare) {
		vospaces = vospaces.filter(function(curvospace, index, array) {
			return curvospace.id != vospace.id;
		});
		dijit.byId("voboxWidget").loginSelect.removeOption(vospace.id);
	}

	dijit.byId("voboxWidget")._refreshRegions();

	var authenticatedVospace, defaultVospace;

	for(var i in vospaces) {
		var vospace = vospaces[i];
		if(vospace.defaultRegion) {
			defaultVospace = vospace;
		}
		if(undefined == authenticatedVospace && undefined != identity.regions[vospace.id]){
			authenticatedVospace = vospace;
		}
	}

	//First try to login to default vospace if is authenticated or don't have any authenticated at all
	if(undefined != identity.regions[defaultVospace.id] || undefined == authenticatedVospace) {
		dijit.byId("voboxWidget").loginToVO(defaultVospace, component);
	} else {
		dijit.byId("voboxWidget").loginToVO(authenticatedVospace, component);
	}

	var otherComponent = (component == panel1)?panel2:panel1;
	if(otherComponent != undefined && otherComponent.store.vospace.id == vospace.id && authenticatedVospace != undefined) {
		dijit.byId("voboxWidget").loginToVO(authenticatedVospace, otherComponent);
	}

	//component._refreshRegions();
		
}