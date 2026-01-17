/**
 * Sanitize HTML content to prevent XSS attacks
 * This is a lightweight sanitizer for basic HTML
 * For production, consider using DOMPurify library
 */

const ALLOWED_TAGS = ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'code', 'pre'];
const ALLOWED_ATTRS = ['href', 'target', 'rel', 'class', 'id'];

// Node type constants for environments where Node is not defined
const TEXT_NODE = typeof Node !== 'undefined' ? Node.TEXT_NODE : 3;
const ELEMENT_NODE = typeof Node !== 'undefined' ? Node.ELEMENT_NODE : 1;

/**
 * Remove dangerous HTML tags and attributes
 * @param {string} dirty - HTML string to sanitize
 * @returns {string} - Sanitized HTML string
 */
export const sanitizeHtml = (dirty) => {
  if (!dirty || typeof dirty !== 'string') return '';
  
  // Check if we're in a browser environment
  if (typeof document === 'undefined') {
    // Server-side: just strip all HTML tags
    return dirty.replace(/<[^>]*>/g, '');
  }
  
  const temp = document.createElement('div');
  temp.innerHTML = dirty;
  
  const clean = (node) => {
    if (node.nodeType === TEXT_NODE) {
      return node.textContent;
    }
    
    if (node.nodeType !== ELEMENT_NODE) {
      return '';
    }
    
    const tagName = node.tagName.toLowerCase();
    
    if (!ALLOWED_TAGS.includes(tagName)) {
      return node.textContent || '';
    }
    
    let result = `<${tagName}`;
    
    for (const attr of node.attributes) {
      const attrName = attr.name.toLowerCase();
      let attrValue = attr.value;
      
      if (ALLOWED_ATTRS.includes(attrName)) {
        if (attrName === 'href') {
          if (attrValue.trim().toLowerCase().startsWith('javascript:')) {
            continue;
          }
        }
        result += ` ${attrName}="${attrValue.replace(/"/g, '&quot;')}"`;
      }
    }
    
    result += '>';
    
    for (const child of node.childNodes) {
      result += clean(child);
    }
    
    result += `</${tagName}>`;
    return result;
  };
  
  let sanitized = '';
  for (const child of temp.childNodes) {
    sanitized += clean(child);
  }
  
  return sanitized;
};

/**
 * Remove all HTML tags and return plain text
 * @param {string} text - Text that may contain HTML
 * @returns {string} - Plain text without HTML
 */
export const sanitizeText = (text) => {
  if (!text || typeof text !== 'string') return '';
  
  // First remove HTML tags
  const withoutTags = text.replace(/<[^>]*>/g, '');
  
  // Check if we're in a browser environment
  if (typeof document === 'undefined') {
    // Server-side: decode common HTML entities manually
    return withoutTags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/');
  }
  
  const temp = document.createElement('div');
  temp.innerHTML = withoutTags;
  
  return temp.textContent || temp.innerText || '';
};

/**
 * Sanitize and truncate text for display
 * @param {string} text - Text to sanitize and truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Sanitized and truncated text
 */
export const sanitizeAndTruncate = (text, maxLength = 150) => {
  const sanitized = sanitizeText(text);
  if (sanitized.length <= maxLength) return sanitized;
  return sanitized.substring(0, maxLength).trim() + '...';
};

/**
 * Sanitize URL to prevent javascript: and data: URLs
 * @param {string} url - URL to sanitize
 * @returns {string} - Sanitized URL or empty string if dangerous
 */
export const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  
  const trimmed = url.trim().toLowerCase();
  
  if (trimmed.startsWith('javascript:') || 
      trimmed.startsWith('data:') || 
      trimmed.startsWith('vbscript:')) {
    return '';
  }
  
  return url;
};

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
export const escapeHtml = (text) => {
  if (!text || typeof text !== 'string') return '';
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  
  return text.replace(/[&<>"'/]/g, (char) => map[char]);
};
