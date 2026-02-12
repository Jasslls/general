import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type { Client, Invoice } from "../models/types";

function money(n: number) {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(dateStr: string) {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    const y = parts[0];
    const m = parts[1];
    const d = parts[2];
    return `${d}/${m}/${y}`;
}

export async function generateInvoicePDF(invoice: Invoice, client: Client) {
    const html = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 40px; }
            .header h1 { margin: 0; font-size: 24px; color: #000; }
            .header p { margin: 5px 0; font-size: 14px; color: #666; }
            
            .row { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .col { flex: 1; }
            .right { text-align: right; }
            
            .label { font-size: 10px; text-transform: uppercase; color: #888; margin-bottom: 4px; font-weight: bold; }
            .val { font-size: 14px; font-weight: 500; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { text-align: left; background: #f4f4f4; padding: 10px; font-size: 12px; text-transform: uppercase; }
            td { padding: 12px 10px; border-bottom: 1px solid #eee; font-size: 14px; }
            .total-row td { font-weight: bold; font-size: 16px; border-top: 2px solid #333; border-bottom: none; }
            
            .footer { margin-top: 60px; text-align: center; font-size: 12px; color: #aaa; border-top: 1px solid #eee; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
            <h1>FACTURA</h1>
            <p>Comprobante de operación</p>
        </div>

        <div class="row">
            <div class="col">
                <div class="label">EMISOR</div>
                <div class="val">PagoFijoHN</div>
                <div class="val">contacto@pagifijo.com</div>
            </div>
            <div class="col right">
                <div class="label">FOLIO</div>
                <div class="val" style="font-size: 18px; color: #000;">${invoice.id}</div>
                <div style="height: 10px;"></div>
                <div class="label">FECHA VENCIMIENTO</div>
                <div class="val">${formatDate(invoice.due)}</div>
            </div>
        </div>

        <div class="row">
            <div class="col">
                <div class="label">CLIENTE</div>
                <div class="val">${client.name}</div>
                <div class="val">${client.company}</div>
                <div class="val">${client.email}</div>
                <div class="val">RFC: ${client.rfc}</div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Descripción</th>
                    <th style="text-align: right; width: 120px;">Importe</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>${invoice.desc}</td>
                    <td style="text-align: right;">${money(invoice.amount)}</td>
                </tr>
                <tr class="total-row">
                    <td style="text-align: right; padding-right: 20px;">TOTAL</td>
                    <td style="text-align: right;">${money(invoice.amount)}</td>
                </tr>
            </tbody>
        </table>

        <div class="footer">
            <p>Gracias por su preferencia.</p>
            <p>Este documento es una representación impresa de un servicio digital.</p>
        </div>
      </body>
    </html>
    `;

    try {
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri, { UTI: ".pdf", mimeType: "application/pdf" });
    } catch (error) {
        console.error("Error generating/sharing PDF:", error);
    }
}
