// Phase 4 共用的本地天气数据源，后续可无缝替换为真实天气服务。
export interface MockWeather {
  temp: number;
  condition: string;
}

export const getMockWeather = (): MockWeather => ({
  temp: 22,
  condition: '多云',
});
