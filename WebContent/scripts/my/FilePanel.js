define([
  "dojo/_base/declare",
  "dojo/_base/connect",
  "dojo/Deferred",
  "dojo/aspect",
  "dojo/_base/array",
  "dojo/on",
  "dojo/keys",
  "dojo/dom-construct",
  "dojo/dom-style",
  "dojo/dom-attr",
  "dojo/store/Memory",
  "dijit/_WidgetBase",
  "dojox/grid/enhanced/plugins/Pagination",
  "dojox/grid/enhanced/plugins/DnD", 
  "dojox/grid/enhanced/plugins/Selector",
  "dojox/grid/enhanced/plugins/Menu",
  "my/DataGrid",
  "dijit/Menu",
  "dojox/image/Lightbox",
  "my/OAuth",
  "my/ConfirmDialog",
  "dijit/_TemplatedMixin",
  "dijit/_WidgetsInTemplateMixin",
  "dijit/layout/_ContentPaneResizeMixin",
  "dojo/text!./templates/FilePanel.html",
  "dijit/layout/BorderContainer",
  "dijit/layout/ContentPane",
  "dijit/layout/_LayoutWidget",
  "dijit/form/Form",
  "dijit/form/Button",
  "dijit/form/Select",
  "dijit/form/CheckBox",
  "dijit/form/ValidationTextBox",
  "dijit/form/TextBox",
  "dijit/form/Textarea",
  "dijit/form/FilteringSelect",
  "dijit/PopupMenuBarItem",
  "dijit/DropDownMenu",
  "dijit/InlineEditBox",
  "dijit/Toolbar",
  "dijit/ProgressBar",
  "dijit/Dialog",
  "dijit/registry",
  "dojox/widget/Dialog",
  "dojo/data/ItemFileWriteStore",
  "dijit/TitlePane",
  ],
  function(declare, connect, Deferred, aspect, array, on, keys, domConstruct, domStyle, domAttr, Memory, WidgetBase, PaginationPlugin, DnDPlugin, SelectorPlugin, 
    MenuPlugin, DataGrid, Menu, LightBox, OAuth, ConfirmDialog, TemplatedMixin, WidgetsInTemplateMixin, _ContentPaneResizeMixin, template, BorderContainer, ContentPane, _LayoutWidget,
    Form, Button, Select, CheckBox, ValidationTextBox, TextBox, Textarea, 
    FilteringSelect, PopupMenuBarItem, DropDownMenu, InlineEditBox, Toolbar, ProgressBar, Dialog, registry, dojox_Dialog, ItemFileWriteStore
    ){
    return declare([WidgetBase, _LayoutWidget, _ContentPaneResizeMixin /* These 2 make it resizing in height on window resize */, TemplatedMixin, WidgetsInTemplateMixin], {

      templateString: template,
      store : null,
      gridWidget: null,
      _menuItems: null,
      _menuSelectedItem: null,

      _uploadFilesQueue: null,
      _isUploading: false,
      _usersListToggler: null,

      postCreate: function(){
        this.inherited(arguments);
        var domNode = this.domNode;
        this.inherited(arguments);

        var panel = this;

        this._uploadFilesQueue = [];

        if(null != this.store) {
          var panel = this; // to keep context

          var selectionMenuObject = new Menu();
          selectionMenuObject.addChild(new dijit.MenuItem({ 
            label: "Delete selection", 
            onClick:function(e) {
              panel._deleteSelected();
            } 
          }));

          this._createUploader();

          var rowMenuObject = new Menu();

          rowMenuObject.addChild(new dijit.MenuItem({ 
            label: "Download", 
            onClick:function(e) {
              dojo.xhrGet(my.OAuth.sign("GET", {
                url: encodeURI(panel.store.vospace.url+"/1/media/sandbox"+panel._menuSelectedItem.i.path),
                handleAs: "json",
                sync: false,
                load: function(data) {
                  require(["dojo/request/iframe"], function(iframe){
                    iframe(data.url, {
                      method: "GET"
                    }).then(function(err){
                      console.debug(err);
                    }).cancel();
                  });
                },
                error: function(error, data) {
                  alert(error+"\n"+data.xhr.responseText);
                }
              },panel.store.vospace.credentials));
            }
          })); 
          rowMenuObject.addChild(new dijit.MenuItem({ 
            label: "Metadata...", 
            onClick:function(e) {
              panel._showMetadata(panel._menuSelectedItem.i.path);
            } 
          }));

          this._menuItems = {};

          this._menuItems['previewMenuItem'] = new dijit.MenuItem({ 
            label: "Preview...",
            onClick:function(e) {
              dojo.xhrGet(my.OAuth.sign("GET", {
                url: encodeURI(panel.store.vospace.url+"/1/media/sandbox"+panel._menuSelectedItem.i.path),
                handleAs: "json",
                sync: false,
                load: function(data) {
                 var lb = new dojox.image.Lightbox({ title:"Preview", group:"group", href:data.url });
                 lb.startup();
                 setTimeout(function(){
                  lb.show();
                }, 2000);
               },
               error: function(error, data) {
                alert(error+"\n"+data.xhr.responseText);
              }
            },panel.store.vospace.credentials));
            } 
          });
          rowMenuObject.addChild(this._menuItems['previewMenuItem']);
          rowMenuObject.addChild(new dijit.MenuItem({ 
            label: "Delete", 
            onClick:function(e) {
              panel._deleteItem(panel._menuSelectedItem.i.path);
            } 
          })); 
          this._menuItems['pullUrlMenuItem'] = new dijit.MenuItem({ 
            label: "Pull from URL...",
            tooltip: "Pull data from URL to the selected item",
            onClick:function(e) {
             panel.transferNode.value = panel._menuSelectedItem.i.path;
             panel.urlInput.reset();
             panel.transferUrlDialog.show();
           } 
         });
        rowMenuObject.addChild(this._menuItems['pullUrlMenuItem']);

        this._menuItems['mediaMenuItem'] = new dijit.MenuItem({ 
          label: "Quick Share URL...", 
          onClick:function(e) {
            dojo.xhrGet(my.OAuth.sign("GET", {
              url: encodeURI(panel.store.vospace.url+"/1/media/sandbox"+panel._menuSelectedItem.i.path),
              handleAs: "json",
              sync: false,
              load: function(data) {
                var infoWindow = new dijit.Dialog({
                  title: "File URL",
                  style: "background-color:white;z-index:5;position:relative;",
                  id : "IndoWindow",
                  onCancel: function() {
                    dijit.popup.close(this);
                    this.destroyRecursive(false);
                  }
                });
                var infoContent = "<p>Data URL: <a href=\""+data.url+"\" target=\"_blank\">"+data.url+"</p>\n";
                infoWindow.set("content",infoContent);
                infoWindow.show();
              },
              error: function(error, data) {
                alert(error+"\n"+data.xhr.responseText);
              }
            },panel.store.vospace.credentials));
          } 
        }); 
        rowMenuObject.addChild(this._menuItems['mediaMenuItem']);

        this._menuItems['shareMenuItem'] = new dijit.MenuItem({ 
          label: "Share...", 
          onClick:function(e) {
            dojo.xhrGet(my.OAuth.sign("GET", {
             url: encodeURI(panel.store.vospace.url+"/1/share_groups"),
             handleAs: "json",
             load: function(data){
                var sharesStore = new Memory({
                  data: data
                });

                panel.shareSelect.store = sharesStore;
                connect.connect(panel.shareSelect, "onChange", function(e) {
                  dojo.xhrGet(my.OAuth.sign("GET", {
                   url: encodeURI(panel.store.vospace.url+"/1/share_groups/"+this.item.id),
                   handleAs: "json",
                   load: function(data){
                      domConstruct.empty(panel.usersList);
                      data.forEach(function(item, num) {
                        var userDiv = dojo.create("div",{innerHTML: item});
                        domConstruct.place(userDiv, panel.usersList);
                      });

                   }, 
                   error: function(error) {
                    console.error("Something bad happened: "+error);
                   }
                  }, panel.store.vospace.credentials));
                });

                panel.chooseShareGroupDialog.startup();

                // reset the dialog if necessary
                panel.chooseShareGroupDialog.show();
            }

            }, panel.store.vospace.credentials));
          } 
        }); 
        rowMenuObject.addChild(this._menuItems['shareMenuItem']);


          rowMenuObject.startup();
          selectionMenuObject.startup();

          this.gridWidget = new DataGrid({
            id: this.grid.id,
            store: this.store,
            structure: [[
                  //{ name: ' ', field: 'is_dir' , formatter: this._formatFileIcon, width: '3%'},
                  { name: 'Name', field: 'path' , formatter: this._getName, width: '62%'},
                  { name: 'Size', field: 'size' , width: "15%"},
                  //{ name: 'Modified', field: 'modified' , width: "20%"},
                  { name: 'Type', field: 'mime_type' , width: "20%"}
                  ]],
            rowSelector: '0px',
            canSort: false,
            plugins:{
              pagination: {
                defaultPageSize: 25, // Integer, what page size will be used by default
                gotoButton: true
              },
              dnd: {
                'dndConfig': {
                   'out': {
                     col: false,
                     row: true,
                     cell: false
                   },
                   'in': {
                     col: false,
                     row: true,
                     cell: false
                   },
                   'within': false
                }
              },
              selector: {
                row: 'multiple',
                cell: 'disabled',
                col: 'disabled'
              },
              menus: {rowMenu: rowMenuObject.id, selectedRegionMenu: selectionMenuObject.id}
            },
            query: {list: 'true'},
            pathWidget: this.pathSelect,
            onRowDblClick : function(e) {
              var item = this.selection.getSelected("row", true)[0];
              if(item.i.is_dir) {
               this.setCurrentPath(item.i.path);
               panel.parentPanel.updateCurrentPanel(panel);
             } else {
               dojo.xhrGet(my.OAuth.sign("GET", {
                 url: encodeURI(panel.store.vospace.url+"/1/media/sandbox"+item.i.path),
                 handleAs: "json",
                 sync: false,
                 load: function(data) {
                  require(["dojo/request/iframe"], function(iframe){
                    iframe(data.url, {
                      method: "GET"
                    }).then(function(err){
                      console.debug(err);
                    }).cancel();
                  });
                },
                error: function(error, data) {
                 alert(error+"\n"+data.xhr.responseText);
                }
              },panel.store.vospace.credentials));
            }
          }
        }, this.grid);
        connect.connect(this.gridWidget.plugin('dnd'), "onDragIn", this, "_dragIn");
        
        connect.connect(this.gridWidget, "dokeypress", this, function(e) {
          if(e.keyCode == keys.DELETE) { // press delete on grid
            this._deleteSelected();
          }
        });
        
        connect.connect(this.gridWidget, "onRowContextMenu", this, "_rowcontextmenu");
        on(this, "click", function(e) {
          this.parentPanel.updateCurrentPanel(this);
        });

        /*Call startup() to render the grid*/
        this.gridWidget.startup();

        this.parentPanel.updateCurrentPanel(this);
      }

    },

    _refresh: function(notRefreshIfUpdating) {
        var gridIsUpdating = (undefined != this.gridWidget._eventSource && this.gridWidget._eventSource.readyState == 1);

        if(!(gridIsUpdating && notRefreshIfUpdating)) {
          this.gridWidget._refresh(true);
          this.gridWidget.plugin('selector').clear();
        }
    },

    _mkdir: function(name) {
      var panel = this;
      if(this.createNewNodeXml != null) {
          var nodeid = this.store.getNodeVoId(this.gridWidget._currentPath+"/"+name);
          var nodeTemplate = formatXml(this.createNewNodeXml("ContainerNode", nodeid, this.store.vospace.id));

          dojo.xhrPut(my.OAuth.sign("PUT", {
           url: encodeURI(this.store.vospace.url+"/nodes"+this.gridWidget._currentPath+"/"+name),
           putData: nodeTemplate,
           handleAs: "text",
           load: function(data){
            //!!panel._refresh();
            },
            error: function(error, data) {
             alert(error+"\n"+data.xhr.responseText);
           }
        }, this.store.vospace.credentials));
      }
    },

    _mkfile: function(name) {
      var panel = this;

      if(panel.gridWidget._currentPath == '/' && !panel.store.vospace.isShare) {
          alert("Regular files can't be created in root folder.");
      } else if(this.createNewNodeXml != null) {
          var nodeid = this.store.getNodeVoId(this.gridWidget._currentPath+"/"+name);
          var nodeTemplate = formatXml(this.createNewNodeXml("DataNode", nodeid, this.store.vospace.id));

          dojo.xhrPut(my.OAuth.sign("PUT", {
           url: encodeURI(this.store.vospace.url+"/nodes"+this.gridWidget._currentPath+"/"+name),
           putData: nodeTemplate,
           handleAs: "text",
           load: function(data){
            //!!panel._refresh();
          },
          error: function(error, data) {
           alert(error+"\n"+data.xhr.responseText);
         }
        }, this.store.vospace.credentials));
      }
    },

    _setCasJobsCredentials: function(casJobsCredentials) {			
      dojo.xhrPut(my.OAuth.sign("PUT", {
        url: this.store.vospace.url +"/1/account/service",
        putData: JSON.stringify(casJobsCredentials),
        handleAs: "text",
        error: function(error, data) {
         alert(error+"\n"+data.xhr.responseText);
       }
      }, this.store.vospace.credentials));
    },

    _dragIn: function(sourcePlugin, isCopy) {
      var selectedArray = sourcePlugin.selector.getSelected("row", true);

      for(var i=0; i<selectedArray.length; i++) {
        var nodePath = selectedArray[i].id;
        var nodeId = sourcePlugin.grid.store.getNodeVoId(nodePath);

        var nodePathArray = nodePath.split('/');
        var nodeName = nodePathArray[nodePathArray.length-1];

        var curPath = this.gridWidget._currentPath;
        var curPathArray = curPath.split('/');
        curPathArray.push(nodeName);
        curPath = curPathArray.join("/");
        var thisNodeId = this.store.getNodeVoId(curPath);

        var store = this.store;
        var args = [store.vospace, thisNodeId];

      	if(sourcePlugin.grid.store.vospace != this.store.vospace) { // different VOSpaces
      		sourcePlugin.grid.store.pullFromVoJob(sourcePlugin.grid.store.vospace, nodeId, store.pullToVoJob, args);
      	} else {
      		sourcePlugin.grid.store.moveJob(store.vospace, nodeId, thisNodeId);
      	}
      }

       var panel = this;

       /*setTimeout(function() {
         panel._refresh();
         sourcePlugin.grid._refresh(true);
       },1000);*///!!
    },

    _deleteSelected: function() {
      var panel = this;
      var selectedItems = this.gridWidget.selection.getSelected("row", true); 
      this._deleteItem(selectedItems);
    },


    _deleteItem: function(path) {
     var panel = this;
     MessageBox.confirm({message: "Remove files?"}).then(function() {
        if(path instanceof Array) {
          for(var i = 0; i < path.length; i++) {
             dojo.xhrDelete(OAuth.sign("DELETE", {
               url: encodeURI(panel.store.vospace.url+"/nodes"+path[i].i.path),
               handleAs: "text",
               load: function(error, ioargs){
                  //!!panel._refresh();
               },
               error: function(error, data) {
                 alert(error+"\n"+data.xhr.responseText);
               }
             }, panel.store.vospace.credentials));
          }

        } else {
         dojo.xhrDelete(OAuth.sign("DELETE", {
           url: encodeURI(panel.store.vospace.url+"/nodes"+path),
           handleAs: "text",
           load: function(error, ioargs){
              //!!panel._refresh();
           },
           error: function(error, data) {
             alert(error+"\n"+data.xhr.responseText);
           }
         }, panel.store.vospace.credentials));
       }

     });
   },



      setStore: function(store) {
          this.store = store;
          this.gridWidget.setStore(store);
       },

       _updateStore: function(path) { // to remove
         if(path.length > 0){this.gridWidget.setCurrentPath(path);}
         this.parentPanel.updateCurrentPanel(this);
       },

       /*_formatFileIcon: function(isDir){
         if(isDir){
          return "<img src='images/folder.jpg' title='Folder' alt='Folder' height='16'/>";
         } else {
          return "<img src='images/file.svg' title='File' alt='File' height='16'/>";
        }
      },*/
      
      _getName: function(path, rowIndex) {
        var pathTokens = path.split('/');

        if(this.grid.getItem(rowIndex).i.is_dir){
          return "<img src='images/folder.gif' title='Folder' alt='Folder' height='10'/>&nbsp;"+pathTokens[pathTokens.length-1];
        } else {
          return "<img src='images/file.svg' title='File' alt='File' height='16'/>&nbsp;"+pathTokens[pathTokens.length-1];
        }
      },
      
    _showMetadata: function(path) {
     var panel = this;

     dojo.xhrGet(OAuth.sign("GET", {
       url: encodeURI(this.store.vospace.url+"/nodes/"+path),
       handleAs: "text",
       load: function(data){
         var editNodeDialog = new dijit.Dialog({
          title: path,
          style: "background-color:white, width: 500px",
          id : "editNodeDialog",
          onCancel: function() {
           dijit.popup.close(this);
           this.destroyRecursive(false);
         }
       });
         var editMetaDiv = dojo.create("div",{id: "metaDiv"});

         var metaEditBox = new InlineEditBox({
          editor: Textarea,
          autoSave:false, 
          value: data,
          id: "nodeXmlContent",
          style: "width: 600px",
          width: "600px",
          onChange: function(value) {

            dojo.xhrPost(my.OAuth.sign("POST", {
              url: encodeURI(panel.store.vospace.url+"/nodes/"+path),
              postData: value,
              handleAs: "text",
              sync: false,
              load: function(data){
               dijit.popup.close(editNodeDialog);
               editNodeDialog.destroyRecursive(false);
             },
             error: function(error, data) {
              alert(error+"\n"+data.xhr.responseText);
            }
          }, panel.store.vospace.credentials));

          }
        }, editMetaDiv);

         editNodeDialog.attr("content", metaEditBox.domNode);
         editNodeDialog.show();

       },
       error: function(error, data) {
         alert(error+"\n"+data.xhr.responseText);
       }
     }, this.store.vospace.credentials));

    },

    _pullToVo: function() {
      this.store.pullToVoJob(this.store.vospace, 
        this.store.getNodeVoId(this.transferNode.value),
        this.urlInput.value);
    },

    _logout: function() {
      if(undefined != logout) {
        logout(this.store.vospace, this);
      }
    },

    updateUserInfo: function(updateInfo /* callback */) {
      var panel = this;
      dojo.xhrGet(OAuth.sign("GET", {
        url: encodeURI(this.store.vospace.url+"/1/account/info"),
        handleAs: "json",
        sync: false,
        load: function(accountInfo) {
          updateInfo(accountInfo);
          panel.gridWidget.setUser(accountInfo.display_name);
        },
        error: function(error, data) {
          console.error(error);
        }
      },this.store.vospace.credentials));
    },

    _uploadFiles: function() {
      var panel = this;

      panel.parentPanel.showUploadPanel();

      this._isUploading = true;

      var curFileStruct = this._uploadFilesQueue.shift();
      var url = encodeURI(curFileStruct.containerUrl+curFileStruct.file.name);

      var xhr = new XMLHttpRequest();
      xhr.open('PUT', url, true);
      // xhr.onload = function(e) { 
      // };
      xhr.setRequestHeader('Authorization', OAuth.sign("PUT", {url: url}, panel.store.vospace.credentials).headers["Authorization"]);

      // Listen to the upload progress.
      xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
          curFileStruct.fileProgressNode.value = (e.loaded / e.total) * 100;
          curFileStruct.fileProgressNode.textContent = curFileStruct.fileProgressNode.value; // Fallback for unsupported browsers.
        }
      };

      on.once(xhr.upload, "loadend", function(){
        if(panel._uploadFilesQueue.length > 0) {
          panel._uploadFiles();
        } else {
          panel._isUploading = false;
          panel.parentPanel.hideUploadPanel();
        }
        domConstruct.destroy(curFileStruct.fileUploadNode);
        //!!panel._refresh(true);
      });

      xhr.onreadystatechange = function(evt){
        if (this.readyState === 4) {
          if (this.status === 200) {
            // upload is OK
          } else {
            if(this.status === 403)
              alert("Can't upload the file: Read Only permissions");
            else
              alert("Can't upload the file: "+this.statusText);
          }
        }
      };

      /*xhr.onreadystatechange = function(evt){
        alert(evt);
      };*/

      xhr.setRequestHeader('Content-Type', 'text/plain; charset=x-user-defined-binary');
      //xhr.overrideMimeType('text/plain; charset=x-user-defined-binary');
      xhr.send(curFileStruct.file);
      //panel.parentPanel.fileuploads.style.display = "block";
      //panel.parentPanel.filetext.innerHTML = "Uploading "+fname+"  ";

      /*reader.onload = (function(file){
        return function(e){
          xhr.sendAsBinary(e.target.result);
        }
      })(curFile);*/

      /*var reader = new FileReader();

      reader.onload = function() {
        xhr.sendAsBinary(reader.result);
      };

      reader.readAsBinaryString(curFile);
      }*/

    },

    _createUploader: function() {
      var panel = this;

      var doc = this.domNode;
      //doc.ondragenter = function () { this.className = ((panel.gridWidget._currentPath != '/')?"hover":"errhover"); return false; };
      //doc.ondragover = function () { this.className = ((panel.gridWidget._currentPath != '/')?"hover":"errhover"); return false; };
      //doc.ondragleave = function () { this.className = ''; return false; };
      doc.ondragenter = function () { return false; };
      doc.ondragover = function () { return false; };
      doc.ondragleave = function () { return false; };
      doc.ondrop = function (event) {
        event.preventDefault && event.preventDefault();
        this.className = '';

        
        if(!panel.store.vospace.isShare && panel.gridWidget._currentPath == '/') {
          alert("Regular files can't be uploaded to root folder.");
        } else {
          var files = event.dataTransfer.files;

          var url = panel.store.vospace.url+"/1/files_put/dropbox"+panel.gridWidget._currentPath+"/";

          for(var i = 0; i < files.length; i++) {
            var curFile = files[i];
            var fname = curFile.name;

            var uploadNode = dojo.create("div");
            domConstruct.place(uploadNode, panel.parentPanel.fileuploads.domNode);

            var uploadNodeText = domConstruct.create("div", {
              innerHTML: fname
            });
            domConstruct.place(uploadNodeText, uploadNode);

            var progressNode = domConstruct.create("progress", {
              min: "0",
              max: "100",
              value: "0",
              class: "fileUploadProgress"
            })

            domConstruct.place(progressNode, uploadNode);

            panel._uploadFilesQueue.push({
              file: curFile,
              fileUploadNode: uploadNode,
              fileProgressNode: progressNode,
              containerUrl: url
            });

            if(!panel._isUploading) {
              panel._uploadFiles();
            }

          }
        }
      };
    },

    _createShareKey: function(e) {
      if(this.shareSelect.validate()) { // proper group name
        this.chooseShareGroupDialog.hide();
        this._createShare();
      }
    },

    _createShare: function(e) {
      var panel = this;
      var params = "";

      if(this.groupEnable.value == "on")
        params += "?group="+this.shareSelect.value;

      params += (params == "")?"?":"&";
      params += "write_perm="+!this.readOnlyCheckBox.checked;

      dojo.xhrPut(my.OAuth.sign("PUT", {
        //url: encodeURI(panel.store.vospace.url+"/1/shares/sandbox"+panel._menuSelectedItem.i.path),
        url: encodeURI(panel.store.vospace.url+"/1/shares/sandbox"+panel._menuSelectedItem.i.path+params),
        handleAs: "json",
        sync: false,
        load: function(data) {

          var url = document.location.href.slice(0,document.location.href.lastIndexOf('/')+1);
          var infoContent = "<p>Share URL: <a href='"+url+"?share="+data.id+"'' target='_blank'>"+url+"?share="+data.id+"</a></p>\n";
          infoContent += "<p align='center'>Share id: <span style='background: #e3e3e3; padding: 5px;'>"+data.id+" </span></p>"

          var infoWindow = new dijit.Dialog({
            title: "Share URL",
            style: "background-color:white;z-index:5;position:relative;",
            content: infoContent,
            onCancel: function() {
              dijit.popup.close(this);
              this.destroyRecursive(false);
            }
          });
          infoWindow.show();
        },
        error: function(error, data) {
          alert(error+"\n"+data.xhr.responseText);
        }
      },panel.store.vospace.credentials));
    },

    _rowcontextmenu: function(e) {
      this._menuSelectedItem = this.gridWidget.getItem(e.rowIndex);

      if(this._menuSelectedItem.i.mime_type && this._menuSelectedItem.i.mime_type.indexOf("image")==0) {
        this._menuItems["previewMenuItem"].set("disabled",false);
      } else {
        this._menuItems["previewMenuItem"].set("disabled",true);
      }

      if(!this._menuSelectedItem.i.mime_type) { // folder
        this._menuItems["pullUrlMenuItem"].set("disabled",true);
      } else {
        this._menuItems["pullUrlMenuItem"].set("disabled",false);
      }

      if(!this.store.vospace.isShare && this.gridWidget._currentPath == '/') { // root
        this._menuItems["shareMenuItem"].set("disabled",false);
      } else {
        this._menuItems["shareMenuItem"].set("disabled",true);
      }

    },

    _enableShareGroup: function(e) {
      this.shareSelect.setDisabled(false);
      domStyle.set(this.usersListDiv, "display", "block");
      this.groupEnable.value = "on";
    },

    _disableShareGroup: function(e) {
      this.shareSelect.setDisabled(true);
      domStyle.set(this.usersListDiv, "display", 'none');
      this.groupEnable.value = "off";
      domConstruct.empty(this.usersList);
    },

  });
});