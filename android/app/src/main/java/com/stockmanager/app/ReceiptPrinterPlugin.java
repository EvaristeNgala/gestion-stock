
package com.stockmanager.app;

import android.content.Context;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.pm.ServiceInfo;
import android.content.Intent;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

import java.util.List;

@CapacitorPlugin(name = "ReceiptPrinter")
public class ReceiptPrinterPlugin extends Plugin {

    // Impression actuelle : conservée
    @PluginMethod
    public void print(PluginCall call) {

        String html = call.getString("html");

        if (html == null || html.trim().isEmpty()) {
            call.reject("Ticket vide.");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                PrintManager manager =
                    (PrintManager) getActivity()
                        .getSystemService(Context.PRINT_SERVICE);

                if (manager == null) {
                    call.reject(
                        "Service d'impression Android indisponible."
                    );
                    return;
                }

                WebView webView = new WebView(getActivity());

                webView.getSettings()
                    .setDefaultTextEncodingName("UTF-8");

                webView.setWebViewClient(new WebViewClient() {

                    private boolean started = false;

                    @Override
                    public void onPageFinished(
                        WebView view,
                        String url
                    ) {
                        if (started) return;
                        started = true;

                        try {
                            PrintAttributes.MediaSize paper =
                                new PrintAttributes.MediaSize(
                                    "ROLL_58MM",
                                    "Papier thermique 58 mm",
                                    2283,
                                    8000
                                );

                            PrintAttributes attributes =
                                new PrintAttributes.Builder()
                                    .setMediaSize(paper)
                                    .setMinMargins(
                                        PrintAttributes.Margins.NO_MARGINS
                                    )
                                    .build();

                            manager.print(
                                "Ticket Stock Manager",
                                view.createPrintDocumentAdapter(
                                    "Ticket Stock Manager"
                                ),
                                attributes
                            );

                            call.resolve(new JSObject());

                        } catch (Exception error) {
                            call.reject(
                                "Erreur lors du lancement de l'impression : "
                                    + error.getMessage()
                            );
                        }
                    }
                });

                webView.loadDataWithBaseURL(
                    null,
                    html,
                    "text/html",
                    "UTF-8",
                    null
                );

            } catch (Exception error) {
                call.reject(
                    "Impossible d'ouvrir l'impression : "
                        + error.getMessage()
                );
            }
        });
    }

    // Diagnostic des services d'impression Android
    @PluginMethod
    public void diagnose(PluginCall call) {

        try {
            PackageManager pm =
                getContext().getPackageManager();

            Intent intent = new Intent(
                "android.printservice.PrintService"
            );

            List<ResolveInfo> services =
                pm.queryIntentServices(intent, 0);

            JSArray results = new JSArray();

            for (ResolveInfo info : services) {

                ServiceInfo service = info.serviceInfo;

                if (service == null) continue;

                JSObject item = new JSObject();

                item.put(
                    "name",
                    String.valueOf(info.loadLabel(pm))
                );

                item.put(
                    "packageName",
                    service.packageName
                );

                item.put(
                    "serviceName",
                    service.name
                );

                item.put(
                    "permission",
                    service.permission == null
                        ? ""
                        : service.permission
                );

                results.put(item);
            }

            JSObject response = new JSObject();

            response.put(
                "manufacturer",
                android.os.Build.MANUFACTURER
            );

            response.put(
                "brand",
                android.os.Build.BRAND
            );

            response.put(
                "model",
                android.os.Build.MODEL
            );

            response.put(
                "device",
                android.os.Build.DEVICE
            );

            response.put(
                "androidVersion",
                android.os.Build.VERSION.RELEASE
            );

            response.put(
                "services",
                results
            );

            response.put(
                "serviceCount",
                services.size()
            );

            call.resolve(response);

        } catch (Exception error) {
            call.reject(
                "Erreur diagnostic : " + error.getMessage()
            );
        }
    }
}
