package com.stockmanager.app;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ReceiptPrinter")
public class ReceiptPrinterPlugin extends Plugin {
    @PluginMethod
    public void print(PluginCall call) {
        String html = call.getString("html");
        if (html == null || html.trim().isEmpty()) {
            call.reject("Ticket vide.");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                PrintManager manager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                if (manager == null) {
                    call.reject("Service d'impression Android indisponible.");
                    return;
                }
                WebView webView = new WebView(getActivity());
                webView.getSettings().setDefaultTextEncodingName("UTF-8");
                webView.setWebViewClient(new WebViewClient() {
                    private boolean started = false;
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        if (started) return;
                        started = true;
                        try {
                            PrintAttributes.MediaSize paper = new PrintAttributes.MediaSize(
                                "ROLL_58MM", "Papier thermique 58 mm", 2283, 8000);
                            PrintAttributes attributes = new PrintAttributes.Builder()
                                .setMediaSize(paper)
                                .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                                .build();
                            manager.print("Ticket Stock Manager", view.createPrintDocumentAdapter("Ticket Stock Manager"), attributes);
                            call.resolve(new JSObject());
                        } catch (Exception error) {
                            call.reject("Erreur lors du lancement de l'impression : " + error.getMessage());
                        }
                    }
                });
                webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
            } catch (Exception error) {
                call.reject("Impossible d'ouvrir l'impression : " + error.getMessage());
            }
        });
    }
}
 