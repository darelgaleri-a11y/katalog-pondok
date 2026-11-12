import React, {useEffect, useMemo, useState} from 'react';
import {supabase} from './supabase.js';

const money = value => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0
}).format(Number(value || 0));

export default function OrderEditStudent({order, products, stores, onClose, onSaved}) {
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!order) return;
    setForm({
      customer_name: order.customer_name || '',
      student_name: order.student_name || '',
      student_room: order.student_room || '',
      student_gender: order.student_gender || 'male',
      delivery_date: order.delivery_date || '',
      payment_method: order.payment_method || 'Transfer bank',
      note: order.note || '',
      items: (order.items || []).map(item => ({
        product_id: item.product_id || '',
        quantity: Math.max(1, Number(item.quantity || 1))
      }))
    });
    setError('');
    setNotice('');
  }, [order?.id]);

  const productMap = useMemo(() => new Map(products.map(p => [String(p.id), p])), [products]);
  const totalPreview = (form?.items || []).reduce((sum, item) => {
    const product = productMap.get(String(item.product_id));
    return sum + Number(product?.price || 0) * Number(item.quantity || 0);
  }, 0);

  if (!form) return null;

  const change = (key, value) => setForm(current => ({...current, [key]: value}));
  const changeItem = (index, key, value) => setForm(current => ({
    ...current,
    items: current.items.map((item, i) => i === index ? {...item, [key]: value} : item)
  }));
  const addItem = () => setForm(current => ({
    ...current,
    items: [...current.items, {product_id: '', quantity: 1}]
  }));
  const removeItem = index => setForm(current => ({
    ...current,
    items: current.items.filter((_, i) => i !== index)
  }));

  async function save(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!form.items.length) return setError('Pesanan harus memiliki minimal satu barang.');
    if (form.items.some(item => !item.product_id || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || Number(item.quantity) > 100)) {
      return setError('Pilih produk dan jumlah 1–100 untuk setiap baris.');
    }
    const seen = new Set();
    for (const item of form.items) {
      if (seen.has(String(item.product_id))) return setError('Produk yang sama tidak boleh dimasukkan dua kali. Gabungkan jumlahnya.');
      seen.add(String(item.product_id));
    }
    if (!window.confirm('Simpan perubahan pesanan santri? Harga dan stok akan divalidasi ulang oleh Supabase.')) return;

    setBusy(true);
    try {
      const {data, error: rpcError} = await supabase.rpc('admin_edit_student_order_v1', {
        p_order_id: order.id,
        p_customer_name: form.customer_name.trim(),
        p_student_name: form.student_name.trim(),
        p_student_room: form.student_room.trim(),
        p_student_gender: form.student_gender,
        p_delivery_date: form.delivery_date,
        p_payment_method: form.payment_method,
        p_note: form.note,
        p_items: form.items.map(item => ({
          product_id: String(item.product_id),
          quantity: Number(item.quantity)
        }))
      });
      if (rpcError) throw rpcError;
      setNotice('Perubahan pesanan berhasil disimpan.');
      await onSaved?.(data);
      onClose();
    } catch (e) {
      setError(e?.message || 'Gagal menyimpan perubahan pesanan.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="orderEditOverlay" role="presentation" onMouseDown={event => {
    if (event.target === event.currentTarget && !busy) onClose();
  }}>
    <section className="panel orderEditModal" role="dialog" aria-modal="true" aria-labelledby="student-order-edit-title">
      <div className="sectionHead">
        <div>
          <span className="eyebrow">KIRIMAN SANTRI</span>
          <h2 id="student-order-edit-title">Edit Pesanan #{order.id.slice(0, 8).toUpperCase()}</h2>
        </div>
        <button type="button" disabled={busy} onClick={onClose}>Tutup</button>
      </div>
      <p className="muted">Harga produk, total, dan ketersediaan stok akan dihitung ulang di database. Pesanan yang sudah dibatalkan tetap berstatus dibatalkan.</p>
      {error && <p className="errorText" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <form className="editor orderEditForm" onSubmit={save}>
        <h3>Data pemesan dan santri</h3>
        <label>Nama pemesan
          <input required maxLength={150} value={form.customer_name} onChange={e => change('customer_name', e.target.value)}/>
        </label>
        <label>Nama santri
          <input required maxLength={150} value={form.student_name} onChange={e => change('student_name', e.target.value)}/>
        </label>
        <label>Kamar / kelas
          <input required maxLength={150} value={form.student_room} onChange={e => change('student_room', e.target.value)}/>
        </label>
        <label>Santri Putra atau Putri
          <select value={form.student_gender} onChange={e => change('student_gender', e.target.value)}>
            <option value="male">Santri Putra</option>
            <option value="female">Santri Putri</option>
          </select>
        </label>
        <label>Tanggal penyerahan
          <input type="date" required value={form.delivery_date} onChange={e => change('delivery_date', e.target.value)}/>
        </label>

        <h3>Daftar barang</h3>
        {form.items.map((item, index) => {
          const selected = productMap.get(String(item.product_id));
          return <div className="orderEditItem" key={`${order.id}-${index}`}>
            <label>Produk
              <select required value={item.product_id} onChange={e => changeItem(index, 'product_id', e.target.value)}>
                <option value="">Pilih produk</option>
                {products.filter(product => (product.audience || 'both') === 'both' || product.audience === 'student')
                  .map(product => <option key={product.id} value={product.id}>
                    {(stores.find(store => store.id === product.storeId)?.name || 'Toko')} — {product.name} ({money(product.price)})
                  </option>)}
              </select>
            </label>
            <label>Jumlah
              <input type="number" min="1" max="100" step="1" required value={item.quantity}
                onChange={e => changeItem(index, 'quantity', e.target.value)}/>
            </label>
            <div className="orderEditItemFoot">
              <span>{selected ? `Subtotal: ${money(Number(selected.price) * Number(item.quantity || 0))}` : 'Pilih produk terlebih dahulu'}</span>
              <button type="button" className="danger" disabled={busy || form.items.length <= 1} onClick={() => removeItem(index)}>Hapus barang</button>
            </div>
          </div>;
        })}
        <button type="button" onClick={addItem}>+ Tambah barang</button>

        <h3>Pembayaran dan catatan</h3>
        <label>Metode pembayaran
          <select value={form.payment_method} onChange={e => change('payment_method', e.target.value)}>
            <option value="Transfer bank">Transfer bank</option>
            <option value="QRIS">QRIS</option>
          </select>
        </label>
        <label>Catatan
          <textarea rows="3" maxLength={2000} value={form.note} onChange={e => change('note', e.target.value)}/>
        </label>
        <div className="total">
          <b>Perkiraan total baru</b>
          <strong>{money(totalPreview)}</strong>
        </div>
        <div className="orderEditActions">
          <button type="button" disabled={busy} onClick={onClose}>Batal</button>
          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </section>
  </div>;
}
