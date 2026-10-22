import { escapeHtml } from './safeHtml'
import { formatRecurrence } from './recurrence'

/**
 * Abre una ventana con la factura lista para imprimir o guardar como PDF.
 * Los colores van fijos a propósito: es un documento impreso, siempre en
 * blanco, y no debe cambiar con el tema del panel.
 */
export function downloadInvoicePDF(bill, clientCompanies, translate, notifyError) {
  const t = key => escapeHtml(translate(key));
  const company = clientCompanies.find(c => c.id === bill.client_company_id);
  const companyName = escapeHtml(company?.name || "-");
  const isCobrar = bill.direction === "cobrar";
  const invoiceNum = escapeHtml(`FAC-${bill.id ? String(bill.id).slice(0,8).toUpperCase() : Date.now()}`);
  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const recurrenceLabel = bill.recurrence_type && bill.recurrence_type !== "none"
    ? escapeHtml(formatRecurrence(bill.recurrence_type, bill.recurrence_value, translate))
    : null;
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>${invoiceNum}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1c1c1e; background: #fff; padding: 48px; }
  .invoice { max-width: 720px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 3px solid ${isCobrar ? "#34C759" : "#FF3B30"}; }
  .company-name { font-size: 36px; font-weight: 800; color: #1c1c1e; letter-spacing: -1px; }
  .invoice-label { text-align: right; }
  .invoice-label h2 { font-size: 22px; font-weight: 700; color: ${isCobrar ? "#34C759" : "#FF3B30"}; text-transform: uppercase; letter-spacing: 2px; }
  .invoice-label p { font-size: 13px; color: #8e8e93; margin-top: 4px; }
  .section { margin-bottom: 32px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #8e8e93; margin-bottom: 8px; }
  .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f2f2f7; font-size: 15px; }
  .row .label { color: #636366; font-weight: 500; }
  .row .value { font-weight: 600; color: #1c1c1e; }
  .amount-box { background: ${isCobrar ? "#34C75912" : "#FF3B3012"}; border: 1.5px solid ${isCobrar ? "#34C759" : "#FF3B30"}; border-radius: 12px; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; margin-top: 12px; }
  .amount-box .amt-label { font-size: 14px; font-weight: 600; color: #636366; text-transform: uppercase; letter-spacing: 0.5px; }
  .amount-box .amt-value { font-size: 32px; font-weight: 800; color: ${isCobrar ? "#34C759" : "#FF3B30"}; }
  .description-box { background: #f9f9f9; border-radius: 10px; padding: 14px 18px; font-size: 14px; color: #3a3a3c; line-height: 1.6; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e5ea; font-size: 12px; color: #aeaeb2; text-align: center; }
  @media print { body { padding: 0; } .invoice { padding: 32px; } }
</style>
</head>
<body>
<div class="invoice">
  <div class="header">
    <div class="company-name">${companyName}</div>
    <div class="invoice-label">
      <h2>${isCobrar ? t('planning.invoiceToReceive') : t('planning.invoiceToPay')}</h2>
      <p>${invoiceNum}</p>
      <p>${t('planning.invoiceIssuedOn')} ${today}</p>
    </div>
  </div>

  <div class="section">
    <div class="section-title">${t('planning.invoiceDetail')}</div>
    <div class="row"><span class="label">${t('planning.invoiceConcept')}</span><span class="value">${escapeHtml(bill.title || "-")}</span></div>
    <div class="row"><span class="label">${t('planning.companyLabel')}</span><span class="value">${companyName}</span></div>
    <div class="row"><span class="label">${t('planning.billingDateLabel')}</span><span class="value">${escapeHtml(bill.billing_date || "-")}</span></div>
    <div class="row"><span class="label">${t('planning.typeLabel')}</span><span class="value">${isCobrar ? t('planning.directionReceive') : t('planning.directionPay')}</span></div>
    ${recurrenceLabel ? `<div class="row"><span class="label">${t('planning.recurrenceLabel')}</span><span class="value">${recurrenceLabel}</span></div>` : ""}
  </div>

  ${bill.description ? `<div class="section"><div class="section-title">${t('planning.descriptionLabel')}</div><div class="description-box">${escapeHtml(bill.description)}</div></div>` : ""}

  <div class="amount-box">
    <span class="amt-label">${t('planning.invoiceTotalAmount')}</span>
    <span class="amt-value">${isCobrar ? "+" : "-"}${escapeHtml(bill.amount)} EUR</span>
  </div>

  <div class="footer">${t('planning.invoiceGeneratedOn')} ${today} — ${invoiceNum}</div>
</div>
<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=820,height=1100");
  if (!win) { notifyError(t('planning.popupBlockedWarning')); return; }
  win.document.write(html);
  win.document.close();
}
