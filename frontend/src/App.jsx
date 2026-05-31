import { useState, useEffect } from 'react'
import axios from 'axios'

function App() {
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(true)

  // 입력 폼 상태 관리
  const [searchKeyword, setSearchKeyword] = useState('')
  const [name, setName] = useState('')
  const [ingredient, setIngredient] = useState('')
  const [dosage, setDosage] = useState('')
  const [location, setLocation] = useState('')
  const [quantity, setQuantity] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [fetchedItems, setFetchedItems] = useState([])
  
  // 🔍 사라졌던 현재고 필터링용 검색어 주머니 복구!
  const [inventorySearchQuery, setInventorySearchQuery] = useState('')

  const fetchInventory = () => {
    axios.get('http://127.0.0.1:8000/api/inventory')
      .then((response) => {
        setMedicines(response.data)
        setLoading(false)
      })
      .catch((error) => console.error("로드 실패:", error))
  }

  useEffect(() => {
    fetchInventory()
  }, [])

  const handleKfdaSearch = () => {
    if (!searchKeyword) return alert("검색어를 입력하세요!")
    axios.get(`http://127.0.0.1:8000/api/search/kfda?keyword=${searchKeyword}`)
      .then((response) => {
        const data = response.data
        if (data.length === 0) return alert("검색 결과가 없습니다.")
        setFetchedItems(data)
        setName(data[0].official_name)
        setIngredient(data[0].extracted_ingredient)
        setDosage(data[0].dosage)
      })
      .catch(() => alert("식약처 조회 실패"))
  }

  const handleSelectChange = (e) => {
    const index = e.target.value
    if (index === "") return
    const selected = fetchedItems[index]
    setName(selected.official_name)
    setIngredient(selected.extracted_ingredient)
    setDosage(selected.dosage)
  }

  const handleExpirationChange = (e) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, '')
    let formatted = rawValue
    if (rawValue.length > 4 && rawValue.length <= 6) {
      formatted = `${rawValue.slice(0, 4)}-${rawValue.slice(4)}`
    } else if (rawValue.length > 6) {
      formatted = `${rawValue.slice(0, 4)}-${rawValue.slice(4, 6)}-${rawValue.slice(6, 8)}`
    }
    setExpirationDate(formatted)
  }

  const handleSave = (e) => {
    e.preventDefault()
    if (!name || !ingredient || !dosage || !quantity) return alert("필수 항목(*)을 입력해주세요!")

    const payload = {
      name,
      ingredient,
      dosage,
      location: location || null,
      quantity: parseInt(quantity, 10),
      expiration_date: expirationDate || null
    }

    axios.post('http://127.0.0.1:8000/api/inventory', payload)
      .then((res) => {
        alert(`💾 DB 처리 결과: ${res.data.message}`)
        setName(''); setIngredient(''); setDosage(''); setLocation(''); setQuantity(''); setExpirationDate(''); setSearchKeyword(''); setFetchedItems([])
        fetchInventory()
      })
      .catch(() => alert("저장 실패"))
  }

  // 🔍 실시간 필터링 엔진 활성화
  const filteredMedicines = medicines.filter((med) => {
    const query = inventorySearchQuery.toLowerCase().trim()
    return med.name.toLowerCase().includes(query) || med.ingredient.toLowerCase().includes(query)
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-xl font-semibold text-slate-600">데이터 로딩 중... 💊</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* 대문 헤더 */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">💊</span>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">약국 재고 관리 시스템 v3.0</h1>
          </div>
          <div className="text-xs font-medium text-slate-500 bg-white px-3 py-1 rounded-full shadow-sm border border-slate-200">
            클라우드 연동 완료
          </div>
        </div>

        {/* 📥 1. 의약품 재고 입력 섹션 */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 mb-6">
          <h2 className="text-md font-bold text-slate-800 mb-4 flex items-center gap-1">📥 의약품 재고 입력</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">식약처 검색</label>
              <div className="flex space-x-2">
                <input 
                  type="text" 
                  value={searchKeyword} 
                  onChange={(e) => setSearchKeyword(e.target.value)} 
                  placeholder="예: 노바스크" 
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
                />
                <button type="button" onClick={handleKfdaSearch} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer">조회</button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">용량 및 규격 선택</label>
              <select 
                onChange={handleSelectChange} 
                disabled={fetchedItems.length === 0}
                className="block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-slate-50 focus:outline-none"
              >
                {fetchedItems.length === 0 ? (
                  <option value="">약품을 먼저 조회해 주세요</option>
                ) : (
                  fetchedItems.map((item, idx) => (
                    <option key={idx} value={idx}>
                      {item.dosage} - {item.official_name.slice(0, 20)}...
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-3 border-t border-slate-100 pt-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">* 확정 약품명</label>
                <input type="text" value={name} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-slate-50 text-slate-800 font-medium" required readOnly />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">* 추출 성분명</label>
                <input type="text" value={ingredient} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-slate-50 text-slate-600" required readOnly />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">* 용량(규격)</label>
                <input type="text" value={dosage} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-slate-50 text-slate-600" required readOnly />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">약품 보관 위치</label>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="예: A-3" className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:border-sky-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">* 입고 재고 수량</label>
                <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="숫자만 입력" className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:border-sky-500" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">유통기한 입력</label>
                <input type="text" value={expirationDate} onChange={handleExpirationChange} placeholder="YYYY-MM-DD" maxLength="10" className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:border-sky-500 font-mono" />
              </div>
            </div>
            
            <button type="submit" className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg text-sm shadow-sm transition-colors cursor-pointer mt-2">
              💾 데이터베이스에 최종 저장
            </button>
          </form>
        </div>

        {/* 🔍 2. 복구된 고속 검색 바 섹션 */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
          <div className="flex items-center space-x-1.5 mb-2">
            <span className="text-sky-500 text-sm">🔍</span>
            <h3 className="text-sm font-bold text-slate-800">현재고 내 고속 검색</h3>
          </div>
          <input 
            type="text" 
            value={inventorySearchQuery} 
            onChange={(e) => setInventorySearchQuery(e.target.value)} 
            placeholder="약품명 또는 성분명을 입력하면 실시간 필터링됩니다..." 
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
        </div>

        {/* 📦 3. 현재 약고 재고 목록 테이블 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-800">📦 현재 약고 재고 목록</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-2.5">ID</th>
                  <th className="px-4 py-2.5">약품명</th>
                  <th className="px-4 py-2.5">성분명</th>
                  <th className="px-4 py-2.5">용량</th>
                  <th className="px-4 py-2.5">위치</th>
                  <th className="px-4 py-2.5">재고</th>
                  <th className="px-4 py-2.5">유통기한</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredMedicines.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-slate-400 font-medium">일치하는 재고가 없습니다.</td>
                  </tr>
                ) : (
                  filteredMedicines.map((med) => (
                    <tr key={med.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">#{med.id}</td>
                      <td className="px-4 py-3 text-slate-900 font-bold">{med.name}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-[150px] truncate">{med.ingredient}</td>
                      <td className="px-4 py-3 font-medium text-slate-700">{med.dosage}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold font-mono ${med.location ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-400'}`}>
                          {med.location || '공란'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-bold ${med.quantity < 5 ? 'text-rose-600' : 'text-slate-900'}`}>
                          {med.quantity} 정
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{med.expiration_date || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}

export default App