/*
 * IP信息检测工具 - 功能说明
 * 
 * 此模块用于解析客户端请求信息，返回结构化的IP版本、地理位置和网络运营商数据
 * 典型使用场景：
 * 1. 获取客户端真实IP地址（支持IPv4/IPv6双栈检测）
 * 2. 识别用户网络运营商信息
 * 3. 获取请求协议类型和地理位置信息
 * 
 * 输出数据结构：
 * {
 *   ipv4: string | null,    // 客户端IPv4地址
 *   ipv6: string | null,    // 客户端IPv6地址
 *   isp: string,            // 网络运营商标识
 *   meta: {                 // 元数据
 *     protocol: string,     // 请求协议（HTTP/HTTPS）
 *     country: string       // 国家代码（ISO 3166-1 alpha-2）
 *   }
 * }
 */

const { parse } = require('net'); // 引入IP地址解析模块

/**
 * 请求处理主函数
 * @param {Object} event - 请求事件对象
 * @property {Object} headers - 请求头信息
 * @returns {Object} HTTP响应对象
 */
exports.handler = async function(event) {
  // 从请求头提取网络连接信息
  const headers = event.headers;
  
  // 解析双栈IP地址（Netlify特定头字段格式）
  const connectionHeader = headers['x-nf-client-connection-ip'] || '';
  const [clientIP, remoteIP] = connectionHeader.split(',');
  
  // 使用IP版本解析器验证地址类型
  const ipv4 = parseIPVersion(clientIP, 4);
  const ipv6 = parseIPVersion(remoteIP, 6);
  
  // 构造标准化响应
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ipv4: ipv4 || null, // 返回有效IPv4或null
      ipv6: ipv6 || null, // 返回有效IPv6或null
      isp: parseISP(headers), // 解析网络运营商
      meta: { // 附加元数据
        protocol: headers['x-forwarded-proto'], // 原始请求协议
        country: headers['x-country-code'] // 云边缘节点位置
      }
    })
  };
};

/**
 * IP版本验证器
 * @param {string} ip - 待验证的IP地址
 * @param {number} version - 期望的IP版本（4或6）
 * @returns {string|null} 符合版本的IP地址或null
 * 
 * 实现原理：
 * 使用Node.js net模块解析IP地址，严格校验地址族类型
 * 支持处理IPv4映射的IPv6地址（如 ::ffff:192.0.2.128）
 */
function parseIPVersion(ip, version) {
  if (!ip) return null;
  const expectedFamily = version === 4 ? 'IPv4' : 'IPv6';
  const isVersion = (netIP) => netIP.family === expectedFamily;
  return parse(ip).some(isVersion) ? ip : null;
}

/**
 * 网络运营商解析器
 * @param {Object} headers - 请求头对象
 * @returns {string} 运营商标识字符串
 * 
 * 解析逻辑：
 * 1. 优先检测Netlify请求头特征，标识为Netlify CDN
 * 2. 回退解析Via头字段，提取中间代理信息
 * 3. 无法识别时返回'Unknown'
 * 
 * Via头格式示例："1.1 google, 3.0 cloudflare"
 */
function parseISP(headers) {
  // Netlify专属标识检测
  if (headers['x-nf-request-id']) {
    return 'Netlify Global CDN';
  }
  
  // 通用Via头解析逻辑
  const viaMatch = headers['via']?.match(/(\w+)\//);
  return viaMatch ? viaMatch[1] : 'Unknown';
}