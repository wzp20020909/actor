import os
import json
from openai import OpenAI
from dotenv import load_dotenv

# 加载 .env 环境变量
load_dotenv()

# 初始化 DeepSeek 客户端
# 注意：DeepSeek API 兼容 OpenAI 格式
api_key = os.getenv("DEEPSEEK_API_KEY")
client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")

def analyze_script_overview(text: str) -> str:
    """
    使用 DeepSeek 模型对提取的剧本/文本进行初步分析
    """
    if not text.strip():
        return "无法分析：提供的文本为空。"
        
    prompt = """请对以下文本进行深度的专业剧本分析。你需要像一位资深的戏剧构作（Dramaturg）一样进行思考。

要求：
1. **直接输出 Markdown 格式的分析报告**，**不要**包含任何诸如“好的，这是分析结果”、“根据您提供的文本”等寒暄或多余的过渡语。
2. 语言必须专业、客观、精炼，避免大白话。
3. 严格按照以下四个模块进行输出：

### 1. 文本体裁判定
（准确判断该文本属于电影剧本、电视剧本、短剧、话剧、小说等哪一种类型，并简要说明判断依据，不超过50字）

### 2. 故事梗概 (Logline)
（用一句高度凝练、具有商业吸引力的话概括整个故事的核心事件，包含主角、目标、阻碍。不超过80字）

### 3. 核心冲突拆解
（深入挖掘文本中的戏剧张力，请分别从以下两个维度进行阐述）：
- **表层冲突 (外部)**: 角色之间、角色与环境之间的直接对抗。
- **深层冲突 (内部)**: 角色内心的挣扎、价值观或阶级立场的对立。

### 4. 主题与基调
- **核心主题**: 提炼 3-5 个精准的学术/行业关键词。
- **情感基调**: 描述故事的整体氛围（如：压抑、荒诞、热血、温情等，并用一句话解释）。

---
【待分析文本内容】：
{text}
"""
    # 扩大截取范围，DeepSeek 支持更长的上下文，截取前 20000 个字符以获取更准确的整体把握
    truncated_text = text[:20000]
    
    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "你是一位资深的戏剧构作与影视剧本策划，负责为剧组提供极其专业、深刻且没有废话的剧本分析报告。"},
                {"role": "user", "content": prompt.format(text=truncated_text)}
            ],
            temperature=0.6,
            max_tokens=2000
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"DeepSeek API Error: {e}")
        return f"分析失败，调用大模型 API 时发生错误：{str(e)}"

def extract_roles_from_script(text: str) -> list:
    """
    使用 DeepSeek 模型从剧本中提取核心角色列表，并返回结构化的 JSON 数据
    """
    if not text.strip():
        return []
        
    prompt = """请阅读以下剧本/小说片段，提取出其中的【所有主要角色及重要配角】。
    
请**务必直接输出严格的 JSON 数组格式**，不要包含任何 Markdown 代码块包裹（如 ```json），也不要包含任何额外的解释性文字。

JSON 数组中的每个对象必须包含以下字段：
- "name" (字符串): 角色名称。
- "role_type" (字符串): 角色定位（如：男一号、女一号、主要配角、反派等）。
- "basic_info" (字符串): 基本信息（年龄、身份、职业，若原文未提及可填"未知"）。
- "personality" (数组): 包含 3-5 个性格关键词的字符串数组。
- "motivation" (字符串): 角色的核心驱动力或目标。
- "classic_line" (字符串): 从原文中摘录的最能代表该角色的一句台词，如果没有具体台词，可以根据角色性格模拟一句，或者留空。

【待分析文本内容】：
{text}
"""
    # 进一步扩大角色提取的文本范围，以便涵盖更多人物出场信息
    truncated_text = text[:40000]
    
    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "你是一个专业的选角导演和剧本分析师。你只能输出纯 JSON 数组数据，绝对不要输出任何其他内容。如果找不到角色，请输出空的 JSON 数组 []。"},
                {"role": "user", "content": prompt.format(text=truncated_text)}
            ],
            temperature=0.2, # 进一步降低随机性以保证 JSON 格式稳定
            max_tokens=2500
        )
        
        content = response.choices[0].message.content.strip()
        # 清理可能存在的 markdown 代码块残留
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
            
        return json.loads(content.strip())
    except json.JSONDecodeError as je:
        print(f"JSON Decode Error: {je}\nRaw Content: {content}")
        # 如果 JSON 解析失败，尝试返回一个错误提示角色卡片，方便前端调试
        return [{"name": "解析失败", "role_type": "系统错误", "basic_info": "大模型返回的格式非标准 JSON", "personality": ["格式错误"], "motivation": str(je), "classic_line": "请检查后台控制台日志。"}]
    except Exception as e:
        print(f"DeepSeek API Error in role extraction: {e}")
        return []

def extract_relationships_from_script(text: str, roles: list) -> dict:
    """
    使用 DeepSeek 模型提取人物关系图谱数据
    """
    if not text.strip() or not roles:
        return {"nodes": [], "links": []}
        
    role_names = [r.get("name", "") for r in roles if r.get("name") and r.get("name") != "解析失败"]
    
    prompt = """请阅读以下剧本/小说片段，提取出角色之间的关系网络。
已知的主要角色有：{roles}

请直接输出严格的 JSON 对象格式，不要包含任何 Markdown 代码块包裹（如 ```json）。
返回的 JSON 必须包含两个键：
1. "nodes": 数组。每个对象包含 "id" (角色名), "name" (角色名), "category" (整数，代表家族或阵营编号，如 0, 1, 2), "symbolSize" (整数，代表角色重要度，建议在 40 到 80 之间)。
2. "links": 数组。每个对象包含 "source" (源角色名), "target" (目标角色名), "value" (字符串，精炼的关系类型，如"夫妻","父子","情敌","主仆"), "weight" (整数1-5，代表关系紧密度或冲突强度，用于连线粗细)。

【待分析文本内容】：
{text}
"""
    truncated_text = text[:40000]
    
    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "你是一个专业的数据分析师，擅长从文本中提取知识图谱。你只能输出纯 JSON 数据，绝对不要输出任何其他内容。"},
                {"role": "user", "content": prompt.format(roles=", ".join(role_names), text=truncated_text)}
            ],
            temperature=0.2,
            max_tokens=2500
        )
        
        content = response.choices[0].message.content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
            
        return json.loads(content.strip())
    except json.JSONDecodeError as je:
        print(f"JSON Decode Error in relationships: {je}\nRaw Content: {content}")
        return {"nodes": [], "links": []}
    except Exception as e:
        print(f"DeepSeek API Error in relationship extraction: {e}")
        return {"nodes": [], "links": []}

def chat_with_script(text: str, question: str) -> str:
    """
    基于提取的剧本内容，回答用户的具体问题
    """
    if not text.strip():
        return "未能读取到剧本内容，请重新上传文件。"
        
    prompt = """你是一个专业的剧本分析助手。请根据以下剧本原文的内容，客观、准确地回答用户的问题。
如果用户的提问超出了剧本的范围，或者剧本中没有提及相关信息，请明确告知“剧本中未提及”，不要自行编造情节。

【剧本原文内容】：
{text}
"""
    # 截取足够的长度作为上下文
    truncated_text = text[:40000]
    
    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": prompt.format(text=truncated_text)},
                {"role": "user", "content": question}
            ],
            temperature=0.7, # 问答可以适当增加一点温度，让语言更自然
            max_tokens=1500
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"DeepSeek API Error in chat: {e}")
        return "抱歉，AI 思考时遇到了网络或接口错误，请稍后再试。"
