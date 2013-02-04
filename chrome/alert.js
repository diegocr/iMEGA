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

let {classes:Cc,interfaces:Ci,utils:Cu,results:Cr} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

let args, iObs = {
	waiting : [],
	QueryInterface : XPCOMUtils.generateQI([Ci.nsISupports, Ci.nsIFactory,
			Ci.nsISupportsWeakReference, Ci.nsIObserver]),
	
	observe : function (s, t, d) {
		if (/^imegaa-/.test(t)) {
			switch (t) {
			case 'imegaa-login-result':
				if ((document.getElementById('login_message').value = '' + d) == 'Logged.') {
					window.setTimeout(window.close.bind(window), 800);
				} else {
					document.documentElement.getButton("accept").disabled = false;
					document.getElementById('login_password').value = '';
				}
				break;
			}
			Services.obs.removeObserver(this, t);
		}
	}
};

function onUnload(g) {
	let result = {
		status : !!g
	};
	
	if (g && args[0] == 1) {
		document.documentElement.getButton("accept").disabled = true;
		document.getElementById('login_message').value = 'Please wait...';
		window.sizeToContent();
		result.u = document.getElementById('login_email').value;
		result.p = document.getElementById('login_password').value;
		Services.obs.addObserver(iObs, result.tob = 'imegaa-login-result', true);
		iObs.waiting.push(result.tob);
	}
	
	if (g) {
		window.setTimeout(function () {
			args[2](result);
		}, 400);
		return args[0] != 1;
	}
	
	args[2](result);
	while (g = iObs.waiting.pop())
		try {
			Services.obs.removeObserver(iObs, g);
		} catch (e) {}
	
	iObs = args = undefined;
	return true;
}

function onLoad() {
	args = window.arguments;
	
	switch (document.getElementById('deck').selectedIndex = args[0] - 1) {
	case 1:
		let m = document.getElementById('message');
		args[1].split(/\r?\n/g).forEach(function (ln) {
			let l = document.createElement('description');
			l.textContent = ln || ' ';
			m.appendChild(l);
		});
		document.documentElement.getButton("cancel").hidden = true;
		break;
	}
	
	document.getElementById('body').setAttribute('style', 'margin:12px 9px;padding:13px;'
		 + 'border:1px solid rgba(20,20,30,0.4);box-shadow:inset 0 0 3px 0 rgba(0,0,0,0.6);'
		 + 'border-radius:7px;background-color:#e4e4e2');
	
	document.documentElement.style.setProperty('padding', '0 0 7px 0', 'important');
	// document.documentElement.style.setProperty('background-color','#D11E00','important');
	document.documentElement.style.setProperty('font', '15px Helvetica', 'important');
	document.documentElement.style.setProperty('max-width', '480px', 'important');
	
	window.sizeToContent();
	window.getAttention();
	window.focus();
	
	[].forEach.call(document.querySelectorAll('textbox'), function (n) {
		n.setAttribute('style', 'font-weight:bold;box-shadow:0 0 3px #9f9e9f;border-radius:4px;');
	});
}
