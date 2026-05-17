import os
import aiofiles
import mammoth
import markdownify
import pdfplumber
import tempfile
import win32com.client as win32
import pythoncom

UPLOAD_DIR = "uploads"

def convert_doc_to_docx(doc_path: str) -> str:
    """
    使用 win32com 将 .doc 文件转换为 .docx 格式，返回新的 .docx 文件路径
    """
    # 确保路径是绝对路径
    doc_path = os.path.abspath(doc_path)
    docx_path = doc_path + "x"
    
    # 初始化 COM
    pythoncom.CoInitialize()
    word = None
    try:
        word = win32.Dispatch('Word.Application')
        word.Visible = False
        doc = word.Documents.Open(doc_path)
        # 16 代表 wdFormatXMLDocument (.docx)
        doc.SaveAs2(docx_path, FileFormat=16)
        doc.Close()
    except Exception as e:
        error_msg = str(e)
        if "-2147023170" in error_msg or "无效的类字符串" in error_msg or "RPC_S_CALL_FAILED" in error_msg:
            raise ValueError("服务器未安装 Microsoft Word 或权限不足，无法自动解析老版 .doc 格式。请手动将其另存为 .docx 或 .pdf 后再上传。")
        raise Exception(f"转换为 docx 失败: {error_msg}")
    finally:
        if word:
            word.Quit()
        pythoncom.CoUninitialize()
        
    return docx_path

async def save_upload_file(upload_file) -> str:
    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR)
        
    file_location = os.path.join(UPLOAD_DIR, upload_file.filename)
    async with aiofiles.open(file_location, "wb+") as file_object:
        content = await upload_file.read()
        await file_object.write(content)
        
    return file_location

def extract_text_from_file(file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower()
    
    if ext == ".txt" or ext == ".md":
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
            
    elif ext == ".docx":
        with open(file_path, "rb") as docx_file:
            result = mammoth.convert_to_html(docx_file)
            html = result.value
            return markdownify.markdownify(html, heading_style="ATX")
            
    elif ext == ".pdf":
        text = ""
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return text
        
    elif ext == ".doc":
        docx_path = convert_doc_to_docx(file_path)
        with open(docx_path, "rb") as docx_file:
            result = mammoth.convert_to_html(docx_file)
            html = result.value
            text = markdownify.markdownify(html, heading_style="ATX")
        # 清理生成的临时 docx
        if os.path.exists(docx_path):
            os.remove(docx_path)
        return text
        
    else:
        raise ValueError(f"暂不支持的文件格式: {ext}，请上传 .txt, .md, .docx, .doc 或 .pdf 格式。")
