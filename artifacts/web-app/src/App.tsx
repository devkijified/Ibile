import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { Toaster } from 'react-hot-toast'

function App() {
  const [products, setProducts] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('products').select('*')
      if (error) {
        setError(error.message)
        console.error(error)
      } else {
        setProducts(data || [])
        console.log('Products:', data)
      }
    }
    load()
  }, [])

  return (
    <div className="p-8">
      <Toaster />
      <h1 className="text-2xl font-bold mb-4">Ibile Bar & Grill</h1>
      {error && <div className="text-red-500 p-4 bg-red-50 rounded">Error: {error}</div>}
      <div className="bg-green-50 p-4 rounded">
        <p>Connected to Supabase</p>
        <p>Products found: {products.length}</p>
      </div>
      <pre className="mt-4 text-sm bg-gray-100 p-4 rounded overflow-auto">
        {JSON.stringify(products.slice(0, 3), null, 2)}
      </pre>
    </div>
  )
}

export default App
