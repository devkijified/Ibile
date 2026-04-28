import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Toaster, toast } from 'react-hot-toast';

function POS() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      const { data, error } = await supabase.from('products').select('*');
      if (error) throw error;
      setProducts(data || []);
      toast.success(`Loaded ${data?.length || 0} products`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading POS...</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <Toaster position="top-right" />
      <h1>Ibile POS Terminal</h1>
      <p>✅ Loaded {products.length} products</p>
      <div style={{ marginTop: '20px' }}>
        <h3>Products:</h3>
        <ul>
          {products.map((p: any) => (
            <li key={p.id}>{p.name} - ₦{p.price} (Stock: {p.stock})</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default POS;
