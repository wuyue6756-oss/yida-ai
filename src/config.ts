// 公开招聘演示只使用mock，不需要也不接受访客提供API密钥。
export const isPublicDemo = import.meta.env.VITE_PUBLIC_DEMO === 'true';
