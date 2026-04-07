/**
 * Axure 渲染引擎通用类型定义
 * 包含所有组件和页面共用的类型、接口和工具函数
 *
 * 本文件为独立副本，可直接复制到目标项目中使用。
 */

// ============ 基础类型定义 ============

// name 字段规则：
// - 必须由小写字母、数字、下划线组成（a-z、0-9、_）
// - 长度 >= 1（不能为空）
// - 建议使用 snake_case 命名风格
//
// 正确示例: 'user_name', 'item_count', 'is_active'
// 错误示例: 'userName', 'ItemCount', 'Is-Active'
export type KeyDesc = {
  name: string;
  desc: string;
};

/**
 * 验证 name 是否符合规范（运行时检查）
 * @param name 要验证的名称
 * @returns 是否合法
 */
export function isValidKeyName(name: string): boolean {
  return /^[a-z0-9_]+$/.test(name);
}

/**
 * 断言 name 符合规范，不符合则抛出错误
 * @param name 要验证的名称
 * @param context 上下文信息（用于错误提示）
 */
export function assertValidKeyName(name: string, context = 'KeyDesc'): void {
  if (!isValidKeyName(name)) {
    throw new Error(
      `[${context}] Invalid name "${name}". Name must only contain lowercase letters, digits, and underscores (a-z, 0-9, _)`
    );
  }
}

export type DataKey = { name: string; desc: string };
export type DataDesc = { name: string; desc: string; keys: DataKey[] };

/**
 * 配置项定义
 * Configuration item definition
 */
export type ConfigItem = {
  /** 组件类型 Component type */
  type?:
  | 'group'           // 分组
  | 'input'           // 文本输入框
  | 'inputNumber'     // 数字输入框
  | 'checkbox'        // 复选框
  | 'slider'          // 滑块
  | 'select'          // 下拉选择框
  | 'autoComplete'    // 自动完成
  | 'colorPicker'     // 颜色选择器
  | 'arrayData'       // 数组数据编辑器
  | 'table'           // 表格数据编辑器
  | 'map'             // 键值对数据编辑器
  | 'fontSetting'     // 字体设置
  | 'lineSetting'     // 线条设置
  | 'pointSetting'    // 端点设置
  | 'collapse';       // 折叠面板

  /** 属性唯一标识符 (supports dot notation like 'style.fontSize') */
  attributeId?: string;

  /** 显示名称 */
  displayName?: string;

  /** 描述信息（提示文本） */
  info?: string;

  /** 默认值 */
  initialValue?: any;

  /** 子配置项 (for nested structures) */
  children?: ConfigItem[];

  /** 是否显示 (default: true) */
  show?: boolean;

  /** 组件特定配置 */
  [k: string]: any;
};

export type Action = { name: string; desc: string; params?: string };
export type EventItem = { name: string; desc: string; payload?: string };

// ============ 组件接口 ============

/**
 * Axure 组件的 Props 接口
 * 所有 Axure 组件都应该接受这些属性
 */
export interface AxureProps {
  /** 数据源，用于传递组件需要的数据 */
  data?: Record<string, any>;
  /** 配置项，用于配置组件的行为和样式 */
  config?: Record<string, any>;
  /** 事件处理函数，组件触发事件时调用
   * ⚠️ 强制规则：payload 必须是字符串类型
   */
  onEvent?: (name: string, payload?: string) => void;
  /** 容器元素，用于挂载组件 */
  container?: HTMLElement | null;
}

/**
 * Axure 组件的 Handle 接口
 * 通过 ref 暴露给外部的方法和属性
 */
export interface AxureHandle {
  /** 获取组件内部变量 */
  getVar: (name: string) => any;
  /** 触发组件动作
   * ⚠️ 强制规则：params 必须是字符串类型
   */
  fireAction: (name: string, params?: string) => void;
  /** 组件支持的事件列表 */
  eventList: EventItem[];
  /** 组件支持的动作列表 */
  actionList: Action[];
  /** 组件暴露的变量列表 */
  varList: KeyDesc[];
  /** 组件的配置项列表 */
  configList: ConfigItem[];
  /** 组件的数据项列表 */
  dataList: DataDesc[];
}

// ============ 工具函数 ============

/**
 * 安全地触发事件
 * @param handler 事件处理函数
 * @param eventName 事件名称
 * @param payload 事件数据（⚠️ 强制规则：必须是字符串类型）
 */
export function safeEmitEvent(
  handler: ((name: string, payload?: string) => void) | undefined,
  eventName: string,
  payload?: string
): void {
  if (typeof handler === 'function') {
    try {
      handler(eventName, payload);
    } catch (error) {
      console.warn(`事件 ${eventName} 调用失败:`, error);
    }
  }
}

/**
 * 创建事件发射器
 * @param onEventHandler 事件处理函数
 * @returns 事件发射函数（⚠️ 强制规则：payload 必须是字符串类型）
 */
export function createEventEmitter(onEventHandler?: (name: string, payload?: string) => void) {
  return function emitEvent(eventName: string, payload?: string) {
    safeEmitEvent(onEventHandler, eventName, payload);
  };
}

/**
 * 获取配置值，如果不存在则返回默认值
 * @param config 配置对象
 * @param key 配置键
 * @param defaultValue 默认值
 * @returns 配置值或默认值
 */
export function getConfigValue<T>(
  config: Record<string, any> | undefined,
  key: string,
  defaultValue: T
): T {
  if (!config || config[key] === undefined) {
    return defaultValue;
  }
  return config[key] as T;
}

/**
 * 获取数据值，如果不存在则返回默认值
 * @param data 数据对象
 * @param key 数据键
 * @param defaultValue 默认值
 * @returns 数据值或默认值
 */
export function getDataValue<T>(
  data: Record<string, any> | undefined,
  key: string,
  defaultValue: T
): T {
  if (!data || data[key] === undefined) {
    return defaultValue;
  }
  return data[key] as T;
}
