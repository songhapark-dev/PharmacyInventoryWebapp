import os
import requests
import re
import xml.etree.ElementTree as ET
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from supabase import create_client, Client
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Access environment variables
KFDA_API_KEY = os.getenv("KFDA_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

# Validate environment variables
if not all([KFDA_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY]):
    raise RuntimeWarning("Missing environment variables in .env file")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

app = FastAPI(title="Pharmacy Inventory Management API")

# Configure CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic data validation schema
class MedicineBase(BaseModel):
    name: str
    ingredient: str
    dosage: str
    location: Optional[str] = None
    quantity: int = 0
    expiration_date: Optional[str] = None


def extract_dosage(eng_name: str) -> str:
    """Extract medicine dosage specification from English name using regex."""
    if not eng_name:
        return "규격확인"
    match = re.search(r'([\d/.]+\s*m?g|mcg)\s*$', eng_name, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return "규격확인"


@app.get("/api/inventory")
def get_inventory():
    """Retrieve all medicine records from the database ordered by latest ID."""
    try:
        response = supabase.table("medicines").select("*").order("id", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")


@app.get("/api/search/kfda")
def search_kfda_medicine(keyword: str):
    """Fetch and parse medicine specification from the KFDA Open Data API."""
    if not keyword:
        raise HTTPException(status_code=400, detail="Search keyword is required.")
    
    api_search_keyword = keyword.replace(" ", "")
    url = f"http://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnInq07?serviceKey={KFDA_API_KEY}"
    
    params = {
        'item_name': api_search_keyword,
        'numOfRows': 20,
        'pageNo': 1
    }
    
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(url, params=params, headers=headers, timeout=7)
        
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="KFDA API server error")
            
        root = ET.fromstring(response.content)
        body = root.find('body')
        if body is None or body.find('items') is None:
            raise HTTPException(status_code=404, detail="No search results found.")
            
        items = body.find('items').findall('item')
        if not items:
            raise HTTPException(status_code=404, detail="No search results found.")
        
        # Parse items and format response for frontend
        result_list = []
        for item in items:
            i_name = item.findtext('ITEM_NAME')
            e_name = item.findtext('ITEM_ENG_NAME')
            m_ingr = item.findtext('ITEM_INGR_NAME') or "정보 없음"
            
            parsed_dosage = extract_dosage(e_name)
            
            result_list.append({
                "official_name": i_name,
                "extracted_ingredient": m_ingr,
                "dosage": parsed_dosage
            })
            
        return result_list
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/inventory")
def add_medicine(medicine: MedicineBase):
    """Insert new medicine record or update quantity if the item exists in the same location."""
    try:
        med_name = medicine.name
        clean_dosage = medicine.dosage
        loc = medicine.location.strip().upper() if medicine.location else None
        
        # Smart Tracking: Auto-match previous location if input location is empty
        if not loc:
            existing_loc_query = supabase.table("medicines") \
                .select("location") \
                .eq("name", med_name) \
                .eq("dosage", clean_dosage) \
                .not_.is_("location", "null") \
                .order("id", desc=True) \
                .limit(1) \
                .execute()
                
            if existing_loc_query.data:
                loc = existing_loc_query.data[0]["location"]

        # Check for existing record matching name, dosage, and location
        query = supabase.table("medicines").select("id", "quantity").eq("name", med_name).eq("dosage", clean_dosage)
        
        if loc:
            query = query.eq("location", loc)
        else:
            query = query.is_("location", "null")
            
        exact_match = query.execute()
        
        if exact_match.data:
            # Flow A: Record exists -> Accumulate stock quantity (UPDATE)
            db_id = exact_match.data[0]["id"]
            current_qty = exact_match.data[0]["quantity"] or 0
            new_qty = current_qty + medicine.quantity
            
            update_data = {"quantity": new_qty}
            if medicine.expiration_date:
                update_data["expiration_date"] = medicine.expiration_date
                
            response = supabase.table("medicines").update(update_data).eq("id", db_id).execute()
            
            msg = f"동일 구역([{loc if loc else '공란'}])에 기존 데이터 행이 존재하여 재고를 합산했습니다."
            return {"status": "accumulated", "message": msg, "data": response.data}
            
        else:
            # Flow B: New item or new location -> Insert new row (INSERT)
            insert_data = {
                "name": med_name,
                "ingredient": medicine.ingredient,
                "dosage": clean_dosage,
                "location": loc,
                "quantity": medicine.quantity,
                "expiration_date": medicine.expiration_date if medicine.expiration_date else None,
                "pharmacy_id": "default_pharmacy"
            }
            response = supabase.table("medicines").insert(insert_data).execute()
            return {"status": "success", "message": "창고에 최초 입고(또는 지정 구역)된 약품으로 신규 등록되었습니다.", "data": response.data}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database transaction error: {str(e)}")
    

# ------------------------------------------------------------
# 🔥 [파일 맨 밑에 추가] 프론트엔드 정적 파일 연결 코드
# ------------------------------------------------------------

# 1. 리액트 빌드 파일이 모여있는 'dist' 폴더 경로 잡기
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
frontend_dist_dir = os.path.join(BASE_DIR, "frontend", "dist")

# 2. /assets 폴더 내부의 css, js 파일들을 FastAPI가 읽을 수 있도록 등록
if os.path.exists(os.path.join(frontend_dist_dir, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist_dir, "assets")), name="assets")

# 3. 사용자가 메인 주소로 들어오면 리액트의 index.html 화면을 띄워주기
@app.get("/{catchall:path}")
def serve_frontend(catchall: str):
    # 만약 사용자가 /api로 시작하는 백엔드 주소를 요청한 게 아니라면 모두 리액트 화면으로 넘깁니다.
    if catchall.startswith("api"):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Not Found")
        
    index_file = os.path.join(frontend_dist_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "프론트엔드 빌드 파일을 찾을 수 없습니다. npm run build를 실행했는지 확인하세요."}