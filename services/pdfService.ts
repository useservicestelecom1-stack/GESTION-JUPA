
import { jsPDF } from 'jspdf';
import { Transaction, Member } from '../types';

const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const generatePaymentReceipt = (transaction: Transaction, member?: Member, bankName?: string) => {
  const doc = new jsPDF();
  
  const orgName = "JUNTA USUARIOS PISCINA ALBROOK";
  const orgSubtitle = "Recibo de Pago Oficial";
  const primaryColor = [13, 148, 136]; 
  const grayColor = [100, 116, 139];

  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(20, 20, 20, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text("J", 26, 32);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(orgName, 50, 28);
  
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(orgSubtitle, 50, 36);

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Fecha: ${transaction.date}`, 150, 28);
  doc.text(`Recibo No: #${transaction.id.slice(-6).toUpperCase()}`, 150, 34);

  doc.setDrawColor(200, 200, 200);
  doc.line(20, 50, 190, 50);

  let startY = 70;
  const lineHeight = 12;

  doc.setFont("helvetica", "bold");
  doc.text("Recibimos de:", 20, startY);
  doc.setFont("helvetica", "normal");
  doc.text(member ? member.fullName : (transaction.description.split('-')[1] || 'Socio / Cliente'), 60, startY);
  
  startY += lineHeight;

  doc.setFont("helvetica", "bold");
  doc.text("La suma de:", 20, startY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(formatCurrency(transaction.amount), 60, startY);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);

  startY += lineHeight;

  doc.setFont("helvetica", "bold");
  doc.text("Por concepto de:", 20, startY);
  doc.setFont("helvetica", "normal");
  doc.text(`${transaction.category} - ${transaction.description}`, 60, startY);

  startY += lineHeight;

  doc.setFont("helvetica", "bold");
  doc.text("Método de Pago:", 20, startY);
  doc.setFont("helvetica", "normal");
  doc.text(bankName || 'Caja / Banco', 60, startY);

  startY += 20;
  doc.setFillColor(248, 250, 252);
  doc.rect(20, startY, 170, 30, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(20, startY, 170, 30, 'S');

  doc.text("Este documento sirve como comprobante oficial del pago realizado a la Junta.", 30, startY + 18);

  const footerY = 240;
  doc.line(20, footerY, 80, footerY);
  doc.text("Entregado por", 20, footerY + 5);
  doc.text("Junta Usuarios Piscina Albrook", 20, footerY + 10);

  doc.line(130, footerY, 190, footerY);
  doc.text("Recibido Conforme", 130, footerY + 5);

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generado el: ${new Date().toLocaleString()}`, 20, 280);

  doc.save(`Recibo_Albrook_${transaction.id}.pdf`);
};

export const generateIncomeStatementPDF = (
    data: {
        income: number;
        expense: number;
        netResult: number;
        incomeByCategory: Record<string, number>;
        expenseByCategory: Record<string, number>;
        projectExpenses: Record<string, number>;
    },
    period: string
) => {
    const doc = new jsPDF();
    const primaryColor = [13, 148, 136];
    const pageWidth = doc.internal.pageSize.width;

    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text("JUNTA USUARIOS PISCINA ALBROOK", pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text("Estado de Resultados", pageWidth / 2, 30, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Período: ${period}`, pageWidth / 2, 38, { align: 'center' });

    doc.setDrawColor(200, 200, 200);
    doc.line(20, 45, pageWidth - 20, 45);

    let currentY = 55;

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text("INGRESOS", 20, currentY);
    currentY += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    Object.entries(data.incomeByCategory).forEach(([cat, amount]) => {
        doc.text(cat, 25, currentY);
        doc.text(formatCurrency(amount), pageWidth - 25, currentY, { align: 'right' });
        currentY += 6;
    });
    
    currentY += 2;
    doc.setDrawColor(100, 100, 100);
    doc.line(100, currentY, pageWidth - 20, currentY);
    currentY += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Total Ingresos", 25, currentY);
    doc.setTextColor(13, 148, 136); 
    doc.text(formatCurrency(data.income), pageWidth - 25, currentY, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    
    currentY += 15;

    doc.setFontSize(12);
    doc.text("GASTOS OPERATIVOS", 20, currentY);
    currentY += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    Object.entries(data.expenseByCategory).forEach(([cat, amount]) => {
        doc.text(cat, 25, currentY);
        doc.text(formatCurrency(amount), pageWidth - 25, currentY, { align: 'right' });
        currentY += 6;
    });

    if (Object.keys(data.projectExpenses).length > 0) {
        currentY += 4;
        doc.setFont("helvetica", "bold");
        doc.text("Proyectos e Inversiones", 25, currentY);
        currentY += 6;
        doc.setFont("helvetica", "normal");
        Object.entries(data.projectExpenses).forEach(([proj, amount]) => {
            doc.text(proj, 30, currentY);
            doc.text(formatCurrency(amount), pageWidth - 25, currentY, { align: 'right' });
            currentY += 6;
        });
    }

    currentY += 2;
    doc.setDrawColor(100, 100, 100);
    doc.line(100, currentY, pageWidth - 20, currentY);
    currentY += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Total Egresos", 25, currentY);
    doc.setTextColor(220, 38, 38); 
    doc.text(formatCurrency(data.expense), pageWidth - 25, currentY, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    currentY += 15;
    doc.setFillColor(240, 240, 240);
    doc.rect(20, currentY - 5, pageWidth - 40, 12, 'F');
    doc.setFontSize(12);
    doc.text("RESULTADO DEL EJERCICIO", 25, currentY + 3);
    
    const resultColor = data.netResult >= 0 ? [13, 148, 136] : [220, 38, 38];
    doc.setTextColor(resultColor[0], resultColor[1], resultColor[2]);
    doc.text(formatCurrency(data.netResult), pageWidth - 25, currentY + 3, { align: 'right' });

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generado automáticamente el ${new Date().toLocaleString()}`, 20, 280);

    doc.save(`Estado_Resultados_${period.replace(/\s/g, '_')}.pdf`);
};
