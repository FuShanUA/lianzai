import sys
import objc
from Foundation import NSBundle
info = NSBundle.mainBundle().infoDictionary()
if info:
    info['CFBundleName'] = "PostOS Pro"
    info['CFBundleDisplayName'] = "PostOS Pro"

from Foundation import NSURL, NSURLRequest
from AppKit import (
    NSApplication, NSApp, NSWindow, NSBackingStoreBuffered, 
    NSWindowStyleMaskTitled, NSWindowStyleMaskClosable, 
    NSWindowStyleMaskMiniaturizable, NSWindowStyleMaskResizable, 
    NSRect, NSPoint, NSSize, NSImage, NSApplicationActivationPolicyRegular
)
from WebKit import WKWebView, WKWebViewConfiguration

class AppDelegate(objc.lookUpClass("NSObject")):
    def applicationDidFinishLaunching_(self, notification):
        # Create window
        rect = NSRect(NSPoint(100, 100), NSSize(1280, 800))
        mask = (NSWindowStyleMaskTitled | 
                NSWindowStyleMaskClosable | 
                NSWindowStyleMaskMiniaturizable | 
                NSWindowStyleMaskResizable)
        
        self.window = NSWindow.alloc().initWithContentRect_styleMask_backing_defer_(
            rect, mask, NSBackingStoreBuffered, False
        )
        self.window.setTitle_("PostOS Pro (深度出版专家)")
        
        # Create WKWebView
        config = WKWebViewConfiguration.alloc().init()
        try:
            # Enable developer options (Right Click -> Inspect)
            config.preferences().setValue_forKey_(True, "developerExtrasEnabled")
        except Exception:
            pass
        
        self.webview = WKWebView.alloc().initWithFrame_configuration_(rect, config)
        self.webview.setUIDelegate_(self)
        url = NSURL.URLWithString_("http://localhost:3005")
        request = NSURLRequest.requestWithURL_(url)
        self.webview.loadRequest_(request)
        
        # Set content view
        self.window.setContentView_(self.webview)
        self.window.makeKeyAndOrderFront_(None)
        
        # Bring to front
        NSApp.activateIgnoringOtherApps_(True)
        
        # Load app icon in dock
        try:
            icon_path = "/Users/shanfu/Desktop/文章连载 Pro.app/Contents/Resources/AppIcon.icns"
            image = NSImage.alloc().initWithContentsOfFile_(icon_path)
            if image:
                NSApp.setApplicationIconImage_(image)
        except Exception as e:
            print(f"Failed to set dock icon: {e}")

    def webView_runOpenPanelWithParameters_initiatedByFrame_completionHandler_(
        self, webView, parameters, frame, completionHandler
    ):
        from AppKit import NSOpenPanel
        panel = NSOpenPanel.openPanel()
        panel.setCanChooseFiles_(True)
        panel.setCanChooseDirectories_(parameters.allowsDirectories())
        panel.setAllowsMultipleSelection_(parameters.allowsMultipleSelection())
        
        result = panel.runModal()
        if result == 1:
            completionHandler(panel.URLs())
        else:
            completionHandler(None)

    def webView_runJavaScriptAlertPanelWithMessage_initiatedByFrame_completionHandler_(
        self, webView, message, frame, completionHandler
    ):
        from AppKit import NSAlert
        alert = NSAlert.alloc().init()
        alert.setMessageText_("PostOS Pro")
        alert.setInformativeText_(message)
        alert.addButtonWithTitle_("确定")
        alert.runModal()
        completionHandler()

    def webView_runJavaScriptConfirmPanelWithMessage_initiatedByFrame_completionHandler_(
        self, webView, message, frame, completionHandler
    ):
        from AppKit import NSAlert
        alert = NSAlert.alloc().init()
        alert.setMessageText_("请确认")
        alert.setInformativeText_(message)
        alert.addButtonWithTitle_("确定")
        alert.addButtonWithTitle_("取消")
        response = alert.runModal()
        completionHandler(response == 1000)

    def applicationShouldTerminateAfterLastWindowClosed_(self, sender):
        return True

def main():
    app = NSApplication.sharedApplication()
    app.setActivationPolicy_(NSApplicationActivationPolicyRegular)
    delegate = AppDelegate.alloc().init()
    app.setDelegate_(delegate)
    app.run()

if __name__ == "__main__":
    main()
