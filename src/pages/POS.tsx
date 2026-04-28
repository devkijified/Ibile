import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast, { Toaster } from 'react-hot-toast';

export default function POS() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .limit(5);
      
      if (error) throw error;
      
      setProducts(data || []);
      toast.success(`Loaded ${data?.length || 0} products`);
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <h2>Error Loading POS</h2>
        <p style={{ color: 'red' }}>{error}</p>
        <button onClick={fetchProducts}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <Toaster position="top-right" />
      <h1>Ibile POS Terminal</h1>
      
      {loading ? (
        <p>Loading products...</p>
      ) : (
        <>
          <p>✅ Loaded {products.length} products</p>
          <div style={{ marginTop: '20px' }}>
            <h3>Products:</h3>
            <ul>
              {products.map(p => (
                <li key={p.id}>{p.name} - ₦{p.price} (Stock: {p.stock})</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
