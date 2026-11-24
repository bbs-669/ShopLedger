const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function item(name, sku, hsn, gstRate, price, qty) {
  return { name, sku, hsn, gstRate, price, qty };
}

function assertCurrentFigures(order, expectedInvoice, expectedCheckout) {
  const checkout = pricing.computeTotals(order.items, order.coupon);
  const printedInvoice = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    subtotal: checkout.subtotal,
    discount: checkout.discount,
    tax: checkout.tax,
    cgst: checkout.cgst,
    sgst: checkout.sgst,
    total: checkout.total
  }, expectedCheckout);
  assert.deepEqual(printedInvoice, expectedInvoice);
}

test('invoice matches checkout HSN rates, capped coupon, GST, and total', function () {
  const orders = [
    {
      id: 1004,
      coupon: 'SAVE10',
      items: [item('Groundnut oil', 'OIL-002', '1508', undefined, 1120, 2)]
    },
    {
      id: 1002,
      coupon: 'SAVE10',
      items: [
        item('Rice', 'GRN-001', '1006', undefined, 640, 1),
        item('Sunflower oil', 'OIL-001', '1512', undefined, 190, 2)
      ]
    },
    {
      id: 1001,
      coupon: '',
      items: [
        item('Rice', 'GRN-001', '1006', undefined, 400, 1),
        item('Ghee', 'DRY-001', '0405', undefined, 210, 1)
      ]
    },
    {
      id: 1008,
      coupon: '',
      items: [
        item('Packaged tea', 'BEV-001', '0902', undefined, 140, 1),
        item('Sherbet concentrate', 'BEV-003', '2106', undefined, 180, 2)
      ]
    }
  ];

  orders.forEach(function (order) {
    const checkout = pricing.computeTotals(order.items, order.coupon);
    const printedInvoice = invoice.computeInvoiceFigures(order);

    assert.deepEqual({
      subtotal: printedInvoice.subtotal,
      discount: printedInvoice.discount,
      tax: printedInvoice.tax,
      cgst: printedInvoice.cgst,
      sgst: printedInvoice.sgst,
      total: printedInvoice.total
    }, {
      subtotal: checkout.subtotal,
      discount: checkout.discount,
      tax: checkout.tax,
      cgst: checkout.cgst,
      sgst: checkout.sgst,
      total: checkout.total
    }, 'invoice totals should match checkout for order #' + order.id);
    assert.deepEqual(printedInvoice.rows.map(function (row) {
      return { gstPercent: row.gstPercent, lineTax: row.lineTax };
    }), checkout.lines.map(function (line) {
      return { gstPercent: line.gstPercent, lineTax: line.tax };
    }), 'invoice line GST should match checkout for order #' + order.id);
  });
});

test('CURRENT BEHAVIOUR: order #1001 has 5% and 12% items and no coupon', function () {
  const order = {
    id: 1001,
    coupon: '',
    items: [
      item('Rice', 'GRN-001', '1006', 5, 400, 1),
      item('Ghee', 'DRY-001', '0405', 12, 210, 1)
    ]
  };

  assertCurrentFigures(order, {
    subtotal: 610,
    discount: 0,
    tax: 45.2,
    cgst: 22.6,
    sgst: 22.6,
    total: 655.2,
    rows: [
      { name: 'Rice', sku: 'GRN-001', hsn: '1006', qty: 1, price: 400, gstPercent: 5, line: 400, lineTax: 20 },
      { name: 'Ghee', sku: 'DRY-001', hsn: '0405', qty: 1, price: 210, gstPercent: 12, line: 210, lineTax: 25.2 }
    ]
  }, {
    subtotal: 610,
    discount: 0,
    tax: 45.2,
    cgst: 22.6,
    sgst: 22.6,
    total: 655.2
  });
});

test('CURRENT BEHAVIOUR: order #1002 applies SAVE10 to a ₹1,020 all-5% cart', function () {
  const order = {
    id: 1002,
    coupon: 'SAVE10',
    items: [
      item('Rice', 'GRN-001', '1006', 5, 640, 1),
      item('Sunflower oil', 'OIL-001', '1512', 5, 190, 2)
    ]
  };

  assertCurrentFigures(order, {
    subtotal: 1020,
    discount: 102,
    tax: 45.9,
    cgst: 22.95,
    sgst: 22.95,
    total: 963.9,
    rows: [
      { name: 'Rice', sku: 'GRN-001', hsn: '1006', qty: 1, price: 640, gstPercent: 5, line: 640, lineTax: 28.8 },
      { name: 'Sunflower oil', sku: 'OIL-001', hsn: '1512', qty: 2, price: 190, gstPercent: 5, line: 380, lineTax: 17.1 }
    ]
  }, {
    subtotal: 1020,
    discount: 102,
    tax: 45.9,
    cgst: 22.95,
    sgst: 22.95,
    total: 963.9
  });
});

test('CURRENT BEHAVIOUR: order #1004 applies the SAVE10 ₹150 cap before tax', function () {
  const order = {
    id: 1004,
    coupon: 'SAVE10',
    items: [
      item('Groundnut oil', 'OIL-002', '1508', 5, 1120, 2)
    ]
  };

  assertCurrentFigures(order, {
    subtotal: 2240,
    discount: 150,
    tax: 104.5,
    cgst: 52.25,
    sgst: 52.25,
    total: 2194.5,
    rows: [
      { name: 'Groundnut oil', sku: 'OIL-002', hsn: '1508', qty: 2, price: 1120, gstPercent: 5, line: 2240, lineTax: 104.5 }
    ]
  }, {
    subtotal: 2240,
    discount: 150,
    tax: 104.5,
    cgst: 52.25,
    sgst: 52.25,
    total: 2194.5
  });
});

test('CURRENT BEHAVIOUR: order #1008 all-18% items and no coupon', function () {
  const order = {
    id: 1008,
    coupon: '',
    items: [
      item('Packaged tea', 'BEV-001', '0902', 18, 140, 1),
      item('Sherbet concentrate', 'BEV-003', '2106', 18, 180, 2)
    ]
  };

  assertCurrentFigures(order, {
    subtotal: 500,
    discount: 0,
    tax: 90,
    cgst: 45,
    sgst: 45,
    total: 590,
    rows: [
      { name: 'Packaged tea', sku: 'BEV-001', hsn: '0902', qty: 1, price: 140, gstPercent: 18, line: 140, lineTax: 25.2 },
      { name: 'Sherbet concentrate', sku: 'BEV-003', hsn: '2106', qty: 2, price: 180, gstPercent: 18, line: 360, lineTax: 64.8 }
    ]
  }, {
    subtotal: 500,
    discount: 0,
    tax: 90,
    cgst: 45,
    sgst: 45,
    total: 590
  });
});
