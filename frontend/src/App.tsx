import React, { useEffect, useState } from 'react';
import { Layout, Typography, Button, Space, Upload, message, Card, Tabs, Spin, Flex, Tag, Row, Col, Divider, Input, List, Avatar, Menu, ConfigProvider, theme } from 'antd';
import { UploadOutlined, FileTextOutlined, RobotOutlined, UserOutlined, ShareAltOutlined, MessageOutlined, SendOutlined, HistoryOutlined, VideoCameraOutlined, PlayCircleOutlined, BulbOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import ReactECharts from 'echarts-for-react';
import './App.css'; // 我们将把动画和复杂样式抽离到单独的 CSS 文件中

const { Header, Content, Footer, Sider } = Layout;
const { Title, Text, Paragraph } = Typography;

function App() {
  const [health, setHealth] = useState<string>('checking...');
  const [parsedData, setParsedData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  
  // 聊天交互相关的状态
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'ai', content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  
  // 历史项目列表
  const [projects, setProjects] = useState<any[]>([]);

  const fetchProjects = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/api/projects');
      setProjects(res.data);
    } catch (err) {
      console.error("Failed to fetch projects", err);
    }
  };

  const loadProject = async (projectId: number) => {
    setLoading(true);
    try {
      const res = await axios.get(`http://127.0.0.1:8000/api/projects/${projectId}`);
      if (res.data.status === 'success') {
        setParsedData(res.data);
        setChatHistory([{ role: 'ai', content: `您好！我已经重新加载了《${res.data.filename}》，您可以继续向我提问。` }]);
        message.success(`已加载项目：${res.data.filename}`);
      }
    } catch (err) {
      message.error("加载项目失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check backend health
    axios.get('http://127.0.0.1:8000/api/health')
      .then(res => {
        setHealth(res.data.status);
        if (res.data.status === 'ok') {
          fetchProjects(); // 后端在线时拉取历史项目
        }
      })
      .catch(() => setHealth('offline'));
  }, []);

  const uploadProps: UploadProps = {
    name: 'file',
    action: 'http://127.0.0.1:8000/api/upload',
    accept: '.txt,.md,.docx,.pdf,.doc',
    headers: {
      authorization: 'authorization-text',
    },
    beforeUpload(file) {
      // 简单校验格式
      const ext = file.name.slice((file.name.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
      if (['txt', 'md', 'docx', 'pdf', 'doc'].indexOf(ext) === -1) {
        message.error(`不支持该文件格式: .${ext}，请上传 TXT/MD/DOCX/PDF/DOC 文件`);
        return Upload.LIST_IGNORE;
      }
      setLoading(true);
      return true;
    },
    onChange(info) {
      if (info.file.status !== 'uploading') {
        console.log(info.file, info.fileList);
      }
      if (info.file.status === 'done') {
        setLoading(false);
        message.success(`${info.file.name} 文件上传并由 AI 分析成功`);
        setParsedData(info.file.response);
        fetchProjects(); // 更新左侧历史列表
        // 清空之前的聊天记录
        setChatHistory([{ role: 'ai', content: `您好！我已经阅读完《${info.file.name}》，您可以随时向我提问关于剧本剧情、人物动机或细节的问题。` }]);
      } else if (info.file.status === 'error') {
        setLoading(false);
        const errorMsg = info.file.response?.detail || '文件上传或分析失败';
        message.error(`${info.file.name} 失败: ${errorMsg}`);
      }
    },
    showUploadList: false,
  };

  const renderRoleCards = (roles: any[]) => {
    if (!roles || roles.length === 0) {
      return <Text type="secondary">未能提取出角色信息</Text>;
    }
    
    return (
      <Row gutter={[16, 16]}>
        {roles.map((role, index) => (
          <Col xs={24} md={12} lg={8} key={index}>
            <Card 
              hoverable 
              className="glass-card"
              title={<span style={{ color: '#d4af37' }}><UserOutlined /> {role.name}</span>}
              extra={<Tag color={role.role_type === '系统错误' ? 'red' : 'gold'}>{role.role_type}</Tag>}
              style={{ height: '100%' }}
            >
              <Paragraph>
                <Text style={{ color: '#a0a0a0' }}>基本信息：</Text> {role.basic_info}
              </Paragraph>
              <Paragraph>
                <Text style={{ color: '#a0a0a0' }}>性格特征：</Text> 
                {Array.isArray(role.personality) ? role.personality.map((p: string, i: number) => (
                  <Tag key={i} color="orange" style={{ marginBottom: '4px', background: 'transparent', borderColor: '#d4af37', color: '#d4af37' }}>{p}</Tag>
                )) : <Text>{role.personality}</Text>}
              </Paragraph>
              <Paragraph>
                <Text style={{ color: '#a0a0a0' }}>核心动机：</Text> {role.motivation}
              </Paragraph>
              <Divider style={{ margin: '12px 0', borderColor: 'rgba(255,255,255,0.1)' }} />
              <Paragraph italic style={{ color: '#888', fontFamily: 'Noto Serif SC' }}>
                "{role.classic_line}"
              </Paragraph>
            </Card>
          </Col>
        ))}
      </Row>
    );
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !parsedData?.project_id) return;
    
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatLoading(true);

    try {
      const res = await axios.post('http://127.0.0.1:8000/api/chat', {
        project_id: parsedData.project_id,
        question: userMsg
      });
      setChatHistory(prev => [...prev, { role: 'ai', content: res.data.answer }]);
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || '网络请求失败，请稍后重试。';
      setChatHistory(prev => [...prev, { role: 'ai', content: `[系统错误] ${errorMsg}` }]);
    } finally {
      setChatLoading(false);
    }
  };
  const getGraphOption = (relationships: any) => {
    if (!relationships || !relationships.nodes || relationships.nodes.length === 0) return {};
    
    // UI-UX-PRO-MAX: 电影级复古高对比调色板 (Cinematic High-Contrast)
    // 采用王家卫风格的复古暖色与赛博霓虹碰撞
    const cinematicColors = [
      '#d4af37', // 剧院金 (主角/核心)
      '#e91e63', // 霓虹粉 (强烈冲突)
      '#00bcd4', // 赛博青 (冷酷/理性)
      '#a39581', // 羊皮纸金 (边缘/辅助)
      '#8a2be2'  // 深邃紫 (神秘/隐藏)
    ];

    // 计算节点的最大权重，用于动态缩放，保证主次分明 (Visual Hierarchy)
    const maxWeight = Math.max(...relationships.nodes.map((n: any) => n.symbolSize || 10));

    const processedNodes = relationships.nodes.map((n: any) => {
      const baseSize = n.symbolSize || 30;
      // UI-UX-PRO-MAX: 动态比例缩放，确保主角(大节点)与配角(小节点)的体积差异明显，但都在安全范围内
      const scaleRatio = baseSize / maxWeight;
      const safeSize = Math.max(30, Math.min(baseSize, 80)); 
      
      const color = cinematicColors[(n.category || 0) % cinematicColors.length];
      
      return {
        ...n,
        symbolSize: safeSize,
        itemStyle: {
          color: color,
          borderColor: 'rgba(255,255,255,0.9)',
          borderWidth: scaleRatio > 0.7 ? 2 : 1, // 核心人物边框更粗
          shadowBlur: scaleRatio > 0.5 ? 40 : 20, // 核心人物发光更强 (Glowing Effect)
          shadowColor: color,
          opacity: 0.95
        },
        label: { 
          show: true, 
          fontSize: scaleRatio > 0.7 ? 16 : 12, // 字体大小随权重变化 (Typography Hierarchy)
          fontFamily: 'Noto Serif SC',
          fontWeight: scaleRatio > 0.7 ? 'bold' : 'normal',
          color: '#fff',
          textShadowColor: 'rgba(0,0,0,0.95)',
          textShadowBlur: 10,
          position: 'right', // 文字统一放在右侧，避免遮挡节点中心
          distance: 10
        }
      };
    });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: 'rgba(15, 10, 20, 0.9)', // Glassmorphism
        borderColor: 'rgba(212, 175, 55, 0.5)',
        borderWidth: 1,
        padding: [12, 16],
        textStyle: { color: '#e0e0e0', fontFamily: 'Noto Serif SC', fontSize: 14 },
        formatter: function (params: any) {
          if (params.dataType === 'edge') {
            return `<div style="font-family:'Courier Prime'; font-size:12px; color:#888; margin-bottom:4px;">RELATION LINK</div>
                    <span style="color:#d4af37; font-weight:bold;">${params.data.source}</span> 
                    <span style="color:#666; margin:0 8px;">→</span> 
                    <span style="color:#00bcd4; font-weight:bold;">${params.data.target}</span>
                    <div style="margin-top:8px; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px; color:#fff;">
                      ${params.data.value}
                    </div>`;
          }
          return `<div style="display:flex; align-items:center;">
                    <div style="width:10px; height:10px; border-radius:50%; background:${params.color}; margin-right:8px; box-shadow:0 0 10px ${params.color};"></div>
                    <span style="font-size:18px; font-weight:bold; color:#fff;">${params.name}</span>
                  </div>`;
        }
      },
      legend: {
        show: true,
        data: ['阵营0', '阵营1', '阵营2', '阵营3', '阵营4'],
        bottom: 20,
        icon: 'circle',
        itemWidth: 10,
        textStyle: {
          color: '#a39581',
          fontFamily: 'Courier Prime',
          fontSize: 12,
          padding: [0, 10, 0, 0]
        }
      },
      animationDurationUpdate: 2500, // 更舒缓的动画过渡 (Motion Easing)
      animationEasingUpdate: 'cubicInOut',
      series: [
        {
          type: 'graph',
          layout: 'force',
          force: {
            repulsion: 3500,        // UI-UX-PRO-MAX: 极大的排斥力，彻底拉开节点间距，留出大量负空间 (Negative Space)
            edgeLength: [200, 500], // 连线变得更长，避免元素拥挤
            gravity: 0.02,          // 极低的引力，产生失重悬浮感
            friction: 0.1           // 增加摩擦力，让节点稳定得更快
          },
          data: processedNodes,
          links: relationships.links.map((l: any) => ({
            ...l,
            lineStyle: { 
              width: Math.max(1, Math.min(l.weight || 2, 4)), 
              curveness: 0.3, // 增加弧度，线条更柔和优雅
              opacity: 0.6   // UI-UX-PRO-MAX: 提高线条透明度，确保在深色背景下清晰可见
            }
          })),
          categories: [
            { name: '阵营0', itemStyle: { color: cinematicColors[0] } }, 
            { name: '阵营1', itemStyle: { color: cinematicColors[1] } }, 
            { name: '阵营2', itemStyle: { color: cinematicColors[2] } }, 
            { name: '阵营3', itemStyle: { color: cinematicColors[3] } }, 
            { name: '阵营4', itemStyle: { color: cinematicColors[4] } }
          ],
          roam: true,
          emphasis: {
            focus: 'adjacency', // UI-UX-PRO-MAX: 悬停时聚焦相邻节点，极大地提升交互清晰度
            blurScope: 'global',
            lineStyle: {
              width: 4,
              opacity: 1, // 悬停时线条高亮
              shadowBlur: 15,
              shadowColor: '#e91e63' // 悬停连线发出霓虹粉光
            },
            itemStyle: {
              shadowBlur: 50
            }
          },
          label: {
            position: 'right',
            formatter: '{b}'
          },
          edgeLabel: {
            show: true,
            fontSize: 13, // 稍微调大字号
            formatter: (params: any) => params.data.value,
            color: '#fff', // 标签文字改为纯白，提升对比度
            fontFamily: 'Noto Serif SC',
            fontWeight: 'bold',
            backgroundColor: 'rgba(20, 10, 30, 0.95)', // 降低背景透明度，使其更像实体标签
            padding: [4, 10],
            borderRadius: 6,
            borderWidth: 1,
            borderColor: '#d4af37', // 边框改为明亮的剧院金
            shadowBlur: 8,
            shadowColor: 'rgba(0,0,0,0.9)'
          },
          lineStyle: {
            color: 'source', // 线条颜色继承源节点颜色，增加逻辑关联性
            curveness: 0.3
          }
        }
      ]
    };
  };

  const getItems = () => [
    {
      key: '1',
      label: <span><RobotOutlined /> 深度剧本分析</span>,
      children: (
        <div style={{ padding: '20px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)' }}>
          {parsedData?.analysis_result ? (
            <ReactMarkdown>{parsedData.analysis_result}</ReactMarkdown>
          ) : (
            <Text type="secondary">暂无分析结果</Text>
          )}
        </div>
      ),
    },
    {
      key: '2',
      label: <span><UserOutlined /> 角色档案卡片</span>,
      children: (
        <div style={{ padding: '10px 0' }}>
          {renderRoleCards(parsedData?.roles)}
        </div>
      ),
    },
    {
      key: '3',
      label: <span><ShareAltOutlined /> 人物关系图谱</span>,
      children: (
        <div style={{ padding: '20px 0', height: '600px', width: '100%', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
          {parsedData?.relationships?.nodes?.length > 0 ? (
            <ReactECharts option={getGraphOption(parsedData.relationships)} style={{ height: '100%', width: '100%' }} theme="dark" />
          ) : (
            <div style={{ textAlign: 'center', marginTop: '100px' }}>
              <Text type="secondary">未能提取出足够的人物关系数据，或大模型解析异常</Text>
            </div>
          )}
        </div>
      ),
    },
    {
      key: '4',
      label: <span><FileTextOutlined /> 原文预览</span>,
      children: (
        <div>
          <Paragraph>
            <Text strong style={{ color: '#d4af37' }}>总字符数：</Text> {parsedData?.total_length}
          </Paragraph>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '4px', whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)' }}>
            {parsedData?.preview}
          </div>
        </div>
      ),
    },
    {
      key: '5',
      label: <span><MessageOutlined /> AI 对话助手</span>,
      children: (
        <div style={{ padding: '20px 0', height: '600px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '20px' }}>
            <List
              itemLayout="horizontal"
              dataSource={chatHistory}
              renderItem={(item) => (
                <List.Item style={{ borderBottom: 'none', padding: '16px 0', justifyContent: item.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  {item.role === 'ai' && (
                    <Avatar style={{ backgroundColor: '#d4af37', marginRight: '12px' }} icon={<RobotOutlined />} />
                  )}
                  <div style={{ 
                    maxWidth: '75%', 
                    padding: '12px 16px', 
                    borderRadius: '8px',
                    backgroundColor: item.role === 'user' ? '#d4af37' : 'rgba(30,30,30,0.8)',
                    color: item.role === 'user' ? '#000' : '#e0e0e0',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    border: item.role === 'ai' ? '1px solid rgba(212, 175, 55, 0.2)' : 'none'
                  }}>
                    <ReactMarkdown>{item.content}</ReactMarkdown>
                  </div>
                  {item.role === 'user' && (
                    <Avatar style={{ backgroundColor: '#fff', color: '#000', marginLeft: '12px' }} icon={<UserOutlined />} />
                  )}
                </List.Item>
              )}
            />
            {chatLoading && (
              <div style={{ padding: '16px 0', display: 'flex', alignItems: 'center' }}>
                <Avatar style={{ backgroundColor: '#d4af37', marginRight: '12px' }} icon={<RobotOutlined />} />
                <Spin size="small" />
                <span style={{ marginLeft: '12px', color: '#999' }}>AI 正在翻阅剧本思考...</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex' }}>
            <Input.TextArea 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="请输入您关于剧本的疑问，例如：四凤为什么害怕打雷？"
              autoSize={{ minRows: 2, maxRows: 4 }}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  handleSendChat();
                }
              }}
              style={{ flex: 1, marginRight: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
            />
            <Button 
              type="primary" 
              icon={<SendOutlined />} 
              onClick={handleSendChat} 
              loading={chatLoading}
              style={{ height: 'auto', borderRadius: '8px', padding: '0 24px', background: '#d4af37', color: '#000', borderColor: '#d4af37' }}
            >
              发送
            </Button>
          </div>
        </div>
      ),
    },
  ];

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#d4af37', // 剧院暗金
          borderRadius: 8,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          colorBgContainer: 'rgba(20, 20, 20, 0.6)', // 玻璃拟态底色
          colorBgElevated: 'rgba(30, 30, 30, 0.8)',
        },
        components: {
          Card: {
            colorBgContainer: 'rgba(20, 20, 20, 0.6)',
          },
          Layout: {
            siderBg: 'rgba(10, 10, 10, 0.8)',
            headerBg: 'rgba(0, 0, 0, 0.5)',
          }
        }
      }}
    >
      <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
        <Sider width={250} className="cinematic-sider">
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <Title level={4} style={{ margin: 0, color: '#d4af37' }}><HistoryOutlined /> 历史剧本</Title>
          </div>
          <Menu
            mode="inline"
            theme="dark"
            selectedKeys={parsedData ? [parsedData.project_id?.toString()] : []}
            style={{ borderRight: 0, background: 'transparent' }}
            items={projects.map(p => ({
              key: p.id.toString(),
              label: p.filename,
              onClick: () => loadProject(p.id)
            }))}
          />
          {projects.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
              暂无历史项目
            </div>
          )}
        </Sider>
        <Layout style={{ background: 'transparent', position: 'relative', zIndex: 1 }}>
          <Header style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)', background: 'rgba(0,0,0,0.3)', position: 'relative', zIndex: 9998, marginTop: '4vh' }}>
            <Title level={3} className="cinematic-title" style={{ color: '#d4af37', margin: 0, letterSpacing: '4px', fontSize: '2rem' }}>
              <VideoCameraOutlined style={{ marginRight: '10px' }} />剧本围读助手
            </Title>
          </Header>
          <Content style={{ padding: '0', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            
            {/* 电影宽银幕黑边 */}
            <div className="letterbox-top"></div>
            <div className="letterbox-bottom"></div>
            
            {/* 巨大的背景装饰文字 */}
            <div className="bg-decorative-text">
              {parsedData ? 'SCENE 01' : 'SCRIPT'}
            </div>

            <div className={parsedData ? "gallery-container" : "art-exhibition-layout"}>
              {!parsedData && (
                <>
                  <div className="left-panel">
                    <Text className="cinematic-subtitle flicker-text" style={{ marginBottom: '20px' }}>
                      ACT I. THE BEGINNING
                    </Text>
                    <Title level={1} className="cinematic-title" style={{ color: '#fff', fontSize: '4rem', marginBottom: '20px' }}>
                      开启您的<br/>戏剧之旅
                    </Title>
                    <Text style={{ color: '#666', fontSize: '1.2rem', letterSpacing: '2px', maxWidth: '400px' }}>
                      沉浸式剧本围读系统。上传您的剧本，让 AI 为您解构每一场爱恨情仇。
                    </Text>
                  </div>
                  
                  <div className="right-panel">
                    <Text className="mono-text" style={{ marginBottom: '10px', fontSize: '12px' }}>
                      [ SYSTEM STATUS: {health === 'ok' ? 'ONLINE' : 'OFFLINE'} ]
                    </Text>
                    <div className="upload-area" style={{ width: '100%', maxWidth: '500px' }}>
                      <Spin spinning={loading} size="large" description={<span style={{ color: '#a39581', fontSize: '14px', letterSpacing: '2px', display: 'inline-block', marginTop: '20px' }}>[ PROCESSING SCRIPT... ]</span>}>
                        <Upload.Dragger {...uploadProps}>
                          <p className="ant-upload-drag-icon" style={{ marginBottom: '30px' }}>
                            <VideoCameraOutlined style={{ color: '#a39581', fontSize: '48px', opacity: 0.8 }} />
                          </p>
                          <p className="ant-upload-text" style={{ color: '#fff', fontSize: '18px', letterSpacing: '2px' }}>[ DRAG & DROP SCRIPT ]</p>
                          <p className="ant-upload-hint mono-text" style={{ fontSize: '12px', marginTop: '20px' }}>
                            TXT / MD / DOCX / PDF
                          </p>
                        </Upload.Dragger>
                      </Spin>
                    </div>
                  </div>
                </>
              )}

              {parsedData && (
                <div style={{ width: '100%', padding: '5vh 5vw', animation: 'lensFocus 1s forwards' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '40px', flexDirection: 'column' }}>
                    <Text className="cinematic-subtitle flicker-text" style={{ marginBottom: '10px' }}>
                      ANALYSIS REPORT
                    </Text>
                    <Title level={1} className="cinematic-title" style={{ fontSize: '3rem', margin: 0 }}>
                      《{parsedData.filename.replace(/\.[^/.]+$/, "")}》
                    </Title>
                  </div>
                  
                  <Card 
                    className="glass-card"
                    style={{ width: '100%' }}
                  >
                    <Tabs defaultActiveKey="1" items={getItems()} size="large" />
                  </Card>
                </div>
              )}
            </div>
          </Content>
          <Footer style={{ textAlign: 'left', background: 'transparent', color: '#444', padding: '20px 5vw', zIndex: 10, fontFamily: 'Courier Prime, monospace', fontSize: '12px', letterSpacing: '1px' }}>
            © {new Date().getFullYear()} SCRIPT READING ASSISTANT. DIRECTED BY AI.
          </Footer>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
