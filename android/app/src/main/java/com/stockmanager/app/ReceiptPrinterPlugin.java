
package com.stockmanager.app;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.pm.ServiceInfo;
import android.os.Build;
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

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(name = "ReceiptPrinter")
public class ReceiptPrinterPlugin extends Plugin {

    private static final UUID SPP_UUID =
        UUID.fromString(
            "00001101-0000-1000-8000-00805F9B34FB"
        );

    // Impression Android actuelle : conservée
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
                                "Erreur impression Android : "
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

    // Diagnostic Android : conservé
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
                Build.MANUFACTURER
            );
            response.put(
                "brand",
                Build.BRAND
            );
            response.put(
                "model",
                Build.MODEL
            );
            response.put(
                "device",
                Build.DEVICE
            );
            response.put(
                "androidVersion",
                Build.VERSION.RELEASE
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

    // Liste des appareils Bluetooth déjà associés
    @PluginMethod
    public void getBluetoothPrinters(PluginCall call) {

        try {
            BluetoothAdapter adapter =
                BluetoothAdapter.getDefaultAdapter();

            if (adapter == null) {
                call.reject(
                    "Bluetooth indisponible sur ce terminal."
                );
                return;
            }

            if (!adapter.isEnabled()) {
                call.reject(
                    "Activez le Bluetooth du terminal."
                );
                return;
            }

            if (!hasBluetoothPermission()) {
                call.reject(
                    "Autorisation Bluetooth manquante."
                );
                return;
            }

            Set<BluetoothDevice> devices =
                adapter.getBondedDevices();

            JSArray results = new JSArray();

            for (BluetoothDevice device : devices) {

                JSObject item = new JSObject();

                item.put(
                    "name",
                    device.getName() == null
                        ? "Appareil sans nom"
                        : device.getName()
                );

                item.put(
                    "address",
                    device.getAddress()
                );

                results.put(item);
            }

            JSObject response = new JSObject();
            response.put("devices", results);
            response.put("count", results.length());

            call.resolve(response);

        } catch (Exception error) {
            call.reject(
                "Erreur Bluetooth : " + error.getMessage()
            );
        }
    }

    // Test d'impression Bluetooth directe
    @PluginMethod
    public void testBluetoothPrinter(PluginCall call) {

        String address = call.getString("address");

        if (address == null ||
            !BluetoothAdapter.checkBluetoothAddress(address)) {
            call.reject("Adresse Bluetooth invalide.");
            return;
        }

        if (!hasBluetoothPermission()) {
            call.reject(
                "Autorisation Bluetooth manquante."
            );
            return;
        }

        new Thread(() -> {

            BluetoothSocket socket = null;

            try {
                BluetoothAdapter adapter =
                    BluetoothAdapter.getDefaultAdapter();

                if (adapter == null || !adapter.isEnabled()) {
                    call.reject(
                        "Bluetooth désactivé ou indisponible."
                    );
                    return;
                }

                BluetoothDevice device =
                    adapter.getRemoteDevice(address);

                if (device.getBondState() !=
                    BluetoothDevice.BOND_BONDED) {
                    call.reject(
                        "Appareil Bluetooth non associé."
                    );
                    return;
                }

                socket =
                    device.createRfcommSocketToServiceRecord(
                        SPP_UUID
                    );

                adapter.cancelDiscovery();
                socket.connect();

                OutputStream output =
                    socket.getOutputStream();

                // Initialisation ESC/POS
                output.write(
                    new byte[]{0x1B, 0x40}
                );

                // Centrer le texte
                output.write(
                    new byte[]{0x1B, 0x61, 0x01}
                );

                String ticket =
                    "STOCK MANAGER\n" +
                    "TEST BLUETOOTH Q2i\n" +
                    "------------------------\n" +
                    "Impression directe OK\n" +
                    "------------------------\n\n\n";

                output.write(
                    ticket.getBytes(
                        StandardCharsets.US_ASCII
                    )
                );

                output.flush();

                JSObject response = new JSObject();
                response.put("success", true);
                response.put(
                    "message",
                    "Commandes envoyées à l'imprimante."
                );

                call.resolve(response);

            } catch (Exception error) {
                call.reject(
                    "Échec du test Bluetooth : "
                        + error.getMessage()
                );
            } finally {
                if (socket != null) {
                    try {
                        socket.close();
                    } catch (Exception ignored) {}
                }
            }

        }).start();
    }

    private boolean hasBluetoothPermission() {

        if (Build.VERSION.SDK_INT >= 31) {
            return getContext().checkSelfPermission(
                Manifest.permission.BLUETOOTH_CONNECT
            ) == PackageManager.PERMISSION_GRANTED;
        }

        return getContext().checkSelfPermission(
            Manifest.permission.BLUETOOTH
        ) == PackageManager.PERMISSION_GRANTED;
    }
}
