const translations = {
  zh: {
    // Layout
    profileManager: 'zcc web - Profile 管理器',
    configScope: '配置范围',
    local: '本地配置',
    global: '全局配置',
    actions: '操作',
    addProfile: '添加 Profile',
    editBase: '编辑 Base',
    fileOperations: '文件操作',
    import: '导入',
    export: '导出',
    viewRawYaml: '查看原始 YAML',

    // ProfileList
    noProfilesFound: '没有找到 profiles',
    clickToAdd: '点击右下角的 + 按钮添加第一个 profile',
    env: '环境变量',
    permissions: '权限配置',
    otherConfig: '其他配置',
    variables: '变量',
    none: '无',
    configured: '已配置',
    edit: '编辑',
    launch: '启动 Claude Code',
    apply: '应用到 settings',
    delete: '删除',

    // ProfileEditor
    editProfile: '编辑 Profile',
    addProfileTitle: '添加 Profile',
    profileId: 'Profile ID',
    environmentVariables: '环境变量',
    addVariable: '添加变量',
    permissionsConfig: '权限配置',
    allow: '允许',
    deny: '拒绝',
    addAllowRule: '添加允许规则',
    addDenyRule: '添加拒绝规则',
    allowExample: '例如：Bash(npm run *)',
    denyExample: '例如：Bash(rm -rf *)',
    modelOverride: '模型映射 (Model Override)',
    modelOverrideHint: '配置模型名称映射，例如：claude-sonnet-4-20250514 → claude-opus-4-20250514',
    addMapping: '添加映射',
    sourceModel: '源模型名称',
    targetModel: '目标模型名称',
    cancel: '取消',
    save: '保存',

    // BaseEditor
    editBaseConfig: '编辑 Base 配置',
    saveBaseConfig: '保存 Base 配置',
    saveSuccess: '保存成功',

    // RawYamlViewer
    viewRawYamlTitle: '查看原始 YAML 配置',
    configFileEmpty: '配置文件为空',
    close: '关闭',

    // ConfigImport
    importConfig: '导入配置文件',
    uploadFile: '上传文件',
    orPasteContent: '或粘贴内容',
    pastePlaceholder: '粘贴 JSON 或 YAML 内容',
    importSuccess: '导入成功',

    // ConfigExport
    exportConfig: '导出配置文件',
    copy: '复制',
    download: '下载',
    copySuccess: '已复制到剪贴板',
    copyFailed: '复制失败',

    // Common
    confirmDelete: '确定要删除 profile',
    deleteFailed: '删除失败',
    saveFailed: '保存失败',
    launchFailed: '启动失败',
    applyFailed: '应用失败',
    fetchFailed: '获取内容失败',
    noConfig: '无配置',
    profiles: '个配置',
    switchToEn: '切换到英文',
    switchToZh: '切换到中文',
  },
  en: {
    // Layout
    profileManager: 'zcc web - Profile Manager',
    configScope: 'Config Scope',
    local: 'Local Config',
    global: 'Global Config',
    actions: 'Actions',
    addProfile: 'Add Profile',
    editBase: 'Edit Base',
    fileOperations: 'File Operations',
    import: 'Import',
    export: 'Export',
    viewRawYaml: 'View Raw YAML',

    // ProfileList
    noProfilesFound: 'No profiles found',
    clickToAdd: 'Click the + button in the bottom right to add your first profile',
    env: 'Environment',
    permissions: 'Permissions',
    otherConfig: 'Other Config',
    variables: 'vars',
    none: 'None',
    configured: 'Configured',
    edit: 'Edit',
    launch: 'Launch Claude Code',
    apply: 'Apply to settings',
    delete: 'Delete',

    // ProfileEditor
    editProfile: 'Edit Profile',
    addProfileTitle: 'Add Profile',
    profileId: 'Profile ID',
    environmentVariables: 'Environment Variables',
    addVariable: 'Add Variable',
    permissionsConfig: 'Permissions',
    allow: 'Allow',
    deny: 'Deny',
    addAllowRule: 'Add Allow Rule',
    addDenyRule: 'Add Deny Rule',
    allowExample: 'e.g., Bash(npm run *)',
    denyExample: 'e.g., Bash(rm -rf *)',
    modelOverride: 'Model Override',
    modelOverrideHint:
      'Configure model name mappings, e.g., claude-sonnet-4-20250514 → claude-opus-4-20250514',
    addMapping: 'Add Mapping',
    sourceModel: 'Source Model',
    targetModel: 'Target Model',
    cancel: 'Cancel',
    save: 'Save',

    // BaseEditor
    editBaseConfig: 'Edit Base Config',
    saveBaseConfig: 'Save Base Config',
    saveSuccess: 'Saved successfully',

    // RawYamlViewer
    viewRawYamlTitle: 'View Raw YAML Configuration',
    configFileEmpty: 'Configuration file is empty',
    close: 'Close',

    // ConfigImport
    importConfig: 'Import Configuration',
    uploadFile: 'Upload File',
    orPasteContent: 'or paste content',
    pastePlaceholder: 'Paste JSON or YAML content',
    importSuccess: 'Imported successfully',

    // ConfigExport
    exportConfig: 'Export Configuration',
    copy: 'Copy',
    download: 'Download',
    copySuccess: 'Copied to clipboard',
    copyFailed: 'Copy failed',

    // Common
    confirmDelete: 'Are you sure you want to delete profile',
    deleteFailed: 'Delete failed',
    saveFailed: 'Save failed',
    launchFailed: 'Launch failed',
    applyFailed: 'Apply failed',
    fetchFailed: 'Failed to fetch content',
    noConfig: 'No config',
    profiles: 'profiles',
    switchToEn: 'Switch to English',
    switchToZh: 'Switch to Chinese',
  },
};

export function getTranslation(key, lang = 'zh') {
  const value = translations[lang]?.[key] || translations.zh?.[key] || key;
  // 开发环境下警告缺失的翻译
  if (process.env.NODE_ENV === 'development' && !translations[lang]?.[key]) {
    console.warn(`[i18n] Missing translation for key "${key}" in language "${lang}"`);
  }
  return value;
}

export { translations };
