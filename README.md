iMEGA Mozilla Firefox Extension
-------------------------------

This add-on is intended to ease the life of the regular MEGA user. Essentially, the idea is providing quick access (ie, one-click solutions) to common actions such as uploads/downloads, sharing, account management, etc

However, since the MEGA Team didn't released a final public API for developers to use, the add-on is limited to provide what really matters for now. That is, it provides support for downloads and automatic log-in to the site (* read below)

Upon install, a Toolbar Button will be added to the Add-On/Navigation Bar (which you can customize, of course) and a window opened asking for your log-in credentials. If you don't have an account don't worry since that's something optional, you'll be asked just once. If you want to enter your credentials at a later time - or change the credentials in use - you can do that by middle-click the toolbar button. These credentials will be checked and saved in the Fx's LoginManager for later use.

Please note checking your credentials might take some time (due cryptographic processing), so please be patient. You might even get a dialog reporting a non-responsive script if you use a very long password, just click on Continue...

Hence, if any entered credentials were correct, you'll be able to go to the MEGA site by clicking the toolbar button and thus without the need to manually entering your log-in details. Note however, this is mainly useful if you've Offline Storage disabled or set to clear up on shutdown, ie: about:config?filter=offlineApps

Downloads support introduced in version 0.2.1 is based in a minimalist File API implementation... that is, it essentially provides just what the site needs to be able to save files from Javascript. On the Add-Ons Manager you can configure where downloads will be saved by default. If you don't specify any folder - or the download filename lacks an extension - you'll be asked before the download starts.