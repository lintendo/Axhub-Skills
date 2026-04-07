/**
 * ConfigPanel API Type Definitions
 * 配置面板 API 类型定义
 *
 * 本文件为独立副本，可直接复制到目标项目中使用。
 *
 * 核心特性：
 * - 声明式配置
 * - 树形结构组织
 * - 动态显示/隐藏
 * - 丰富的组件类型
 */

// ============================================================================
// 核心类型定义 Core Type Definitions
// ============================================================================

/**
 * 配置项基础属性
 * Base properties for all configuration items
 */
export interface AttributeComponentProps {
  /** 组件类型 Component type (e.g., 'input', 'select', 'colorPicker') */
  type?: string;

  /** 属性唯一标识符 Unique attribute identifier (supports dot notation like 'style.fontSize') */
  attributeId?: string;

  /** 显示名称 Display name shown in UI */
  displayName?: string;

  /** 描述信息（提示文本） Description or tooltip text */
  info?: string;

  /** 默认值 Initial/default value */
  initialValue?: any;

  /** 子配置项 Child configuration items (for nested structures) */
  children?: AttributeComponentProps[];

  /** 是否显示 Whether to show this item (default: true) */
  show?: boolean;

  /** 组件特定配置 Component-specific configuration properties */
  [k: string]: any;
}

/**
 * 完整配置对象
 * Complete configuration object
 */
export interface AttributesConfig {
  /** 配置树 Configuration tree */
  config: AttributeComponentProps;
}

// ============================================================================
// 布局组件 Layout Components
// ============================================================================

/**
 * 分组配置
 * Group configuration
 */
export interface GroupConfig extends AttributeComponentProps {
  type: 'group';
  displayName: string;
  displayType?: 'inline' | 'default';
  children: AttributeComponentProps[];
}

// ============================================================================
// 基础输入组件 Basic Input Components
// ============================================================================

/**
 * 文本输入框配置
 */
export interface InputConfig extends AttributeComponentProps {
  type: 'input';
  attributeId: string;
  displayName: string;
  placeholder?: string;
  width?: string;
  disabled?: boolean;
  initialValue?: string;
}

/**
 * 数字输入框配置
 */
export interface InputNumberConfig extends AttributeComponentProps {
  type: 'inputNumber';
  attributeId: string;
  displayName: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  initialValue?: number;
}

/**
 * 复选框配置
 */
export interface CheckboxConfig extends AttributeComponentProps {
  type: 'checkbox';
  attributeId: string;
  displayName: string;
  disabled?: boolean;
  initialValue?: boolean;
}

/**
 * 滑块配置
 */
export interface SliderConfig extends AttributeComponentProps {
  type: 'slider';
  attributeId: string;
  displayName: string;
  min: number;
  max: number;
  step?: number;
  showInputNumber?: boolean;
  initialValue?: number;
}

// ============================================================================
// 选择组件 Selection Components
// ============================================================================

/**
 * 选项定义
 */
export interface SelectOption {
  label: string;
  value: string | number;
}

/**
 * 下拉选择框配置
 */
export interface SelectConfig extends AttributeComponentProps {
  type: 'select';
  attributeId: string;
  displayName: string;
  options: SelectOption[];
  mode?: 'multiple';
  dropdownMatchSelectWidth?: number;
  initialValue?: string | number | string[] | number[];
}

/**
 * 自动完成配置
 */
export interface AutoCompleteConfig extends AttributeComponentProps {
  type: 'autoComplete';
  attributeId: string;
  displayName: string;
  options: SelectOption[];
  popupMatchSelectWidth?: number;
  initialValue?: string;
}

// ============================================================================
// 颜色组件 Color Components
// ============================================================================

/**
 * 颜色选择器配置
 */
export interface ColorPickerConfig extends AttributeComponentProps {
  type: 'colorPicker';
  attributeId: string;
  displayName: string;
  picker?: 'common' | 'lite';
  initialValue?: string;
}

// ============================================================================
// 复杂数据组件 Complex Data Components
// ============================================================================

/**
 * 数组数据编辑器配置
 */
export interface ArrayDataConfig extends AttributeComponentProps {
  type: 'arrayData';
  attributeId: string;
  displayName: string;
  initialValue?: string[];
}

/**
 * 表格列定义
 */
export interface TableColumn {
  name: string;
  colName: string;
  type: 'text' | 'select' | 'color' | 'number' | 'icon';
  options?: SelectOption[];
}

/**
 * 表格数据编辑器配置
 */
export interface TableConfig extends AttributeComponentProps {
  type: 'table';
  attributeId: string;
  displayName: string;
  isMap?: boolean;
  columns: TableColumn[];
  initialValue?: any[];
}

/**
 * Map 列定义
 */
export interface MapColumn {
  key: string;
  colName: string;
  type: 'text' | 'select' | 'color' | 'number' | 'icon';
  attributeId: string;
  options?: SelectOption[];
}

/**
 * 键值对数据编辑器配置
 */
export interface MapConfig extends AttributeComponentProps {
  type: 'map';
  attributeId: string;
  displayName: string;
  columns: MapColumn[];
  initialValue?: Record<string, any>;
}

// ============================================================================
// 组合组件 Composite Components
// ============================================================================

/**
 * 字体设置配置
 */
export interface FontSettingConfig extends AttributeComponentProps {
  type: 'fontSetting';
  displayName: string;
  attributeIdMap: {
    fontColor?: string;
    fontSize?: string;
    fontWeight?: string;
    fontFamily?: string;
    textAlign?: string;
    opacity?: string;
  };
  initialValue?: {
    fontColor?: string;
    fontSize?: number;
    fontWeight?: string;
    fontFamily?: string;
    textAlign?: string;
    opacity?: number;
  };
}

/**
 * 线条设置配置
 */
export interface LineSettingConfig extends AttributeComponentProps {
  type: 'lineSetting';
  displayName: string;
  attributeIdMap: {
    lineWidth?: string;
    lineColor?: string;
    lineDash?: string;
    length?: string;
  };
  initialValue?: {
    lineWidth?: number;
    lineColor?: string;
    lineDash?: number[];
    length?: number;
  };
}

/**
 * 端点设置配置
 */
export interface PointSettingConfig extends AttributeComponentProps {
  type: 'pointSetting';
  displayName: string;
  attributeIdMap?: Record<string, string>;
  initialValue?: any;
}

// ============================================================================
// 最佳实践 Best Practices
// ============================================================================

/**
 * 最佳实践指南
 *
 * 1. attributeId 命名规范：
 *    - 使用点分隔的路径: 'style.fontSize'
 *    - 保持一致性和可读性
 *    - 避免使用特殊字符
 *
 * 2. 初始值设置：
 *    - 始终提供合理的 initialValue
 *    - 确保初始值类型与组件匹配
 *
 * 3. 分组组织：
 *    - 使用 Collapse 组织大量配置项
 *    - 使用 Group 进行逻辑分组
 *    - 相关配置项放在一起
 *
 * 4. 性能优化：
 *    - 避免过深的嵌套层级
 *    - 合理使用 show 属性预先隐藏不需要的项
 *    - 大量数据使用 Table 或 Map 组件
 */
