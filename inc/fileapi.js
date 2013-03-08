/* ***** BEGIN LICENSE BLOCK *****
 * Version: GPL License
 * 
 * Copyright (C) 2013 Diego Casorran <dcasorran@gmail.com>
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>
 * 
 * ***** END LICENSE BLOCK ***** */

(function(scope) {
	
	if(scope.requestFileSystem || scope.webkitRequestFileSystem) {
		if(!scope.webkitRequestFileSystem)
			scope.webkitRequestFileSystem = scope.requestFileSystem;
		return;
	}
	
	scope.webkitStorageInfo = {
		TEMPORARY: 0,
		requestQuota: function(t,s,f) f(s),
		queryUsageAndQuota: function(t,f) f(0,1e11)
	};
	
	scope.TEMPORARY = 0;
	
	let push = function(type, node) {
		let ev = scope.document.createEvent("Events");
		ev.initEvent(type, true, false);
		node.dispatchEvent(ev);
	};
	
	let fs = {
		name : location.host,
		root : {
			getDirectory : function() {},
			createReader : function() {
				return { readEntries : function() {}}
			},
			getFile : function(name,opts,callback) {
				let File = {
					name : '/' + name,
					toURL : function() {
						push("iMEGADownloadComplete", this.node);
						scope.document.documentElement.removeChild(this.node);
						return 'imega:/' + this.name;
					},
					createWriter : function(callback) {
						this.Writer = {
							DONE : 1,
							WRITING : 0,
							readyState : -1,
							position : 0,
							write : function(x) {
								this.readyState = this.WRITING;
								this.position = this.writepos+x.size;
								
								scope[File.node.nodeName] = x;
								push("iMEGADownloadWrite", File.node);
							},
							seek : function(p) {
								File.node.setAttribute('data', p);
								push("iMEGADownloadSeek", File.node);
							}
						};
						
						callback(this.Writer);
					}
				};
				
				let node = scope.document.createElement("iMEGADownload" + File.name.replace('/',':','g'));
				node.setAttribute("filename", scope.dl_filename);
				node.setAttribute("filesize", scope.dl_filesize);
				try {
					if(scope.dl_queue[scope.dl_queue_num].p)
						node.setAttribute("folder", scope.dl_queue[scope.dl_queue_num].p);
				} catch(e) {}
				scope.document.documentElement.appendChild(node);
				
				node.addEventListener('iMEGADownloadWriter', function(ev) {
					delete scope[File.node.nodeName];
					File.Writer.readyState = File.Writer.DONE;
					File.Writer.onwriteend();
				}, false);
				
				node.addEventListener('iMEGADownloadResponse', function(ev) {
					node.removeEventListener('iMEGADownloadResponse', arguments.callee, false);
					
					if(node.hasAttribute('success')) {
						callback(File);
					} else {
						scope.document.documentElement.removeChild(node);
						node = null;
					}
				}, false);
				
				push("iMEGADownloadRequest", File.node = node);
			}
		}
	};
	
	function FakeFileAPI(type, size, callback) {
		if(~[0,1].indexOf(type)) {
			callback(fs);
		}
	}
	
	scope.webkitRequestFileSystem = scope.requestFileSystem = FakeFileAPI;
	
})(self);
