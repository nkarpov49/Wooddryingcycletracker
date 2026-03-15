import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { WeighingRecord } from '../utils/api';
import { TrendingDown, Scale } from 'lucide-react';
import { useLanguage } from '../utils/i18n';

interface WeightProgressChartProps {
  weighingHistory: WeighingRecord[];
  targetWeight?: number;
}

export default function WeightProgressChart({ weighingHistory, targetWeight }: WeightProgressChartProps) {
  const { t } = useLanguage();
  
  if (!weighingHistory || weighingHistory.length === 0) {
    return null;
  }

  // Подготовка данных для графика
  const chartData = weighingHistory.map((record, index) => {
    const avgWeight = record.weights.reduce((sum, w) => sum + w, 0) / record.weights.length;
    const maxWeight = Math.max(...record.weights);
    const minWeight = Math.min(...record.weights);
    
    return {
      checkpoint: `#${index + 1}`,
      hours: record.hoursFromStart,
      avgWeight: parseFloat(avgWeight.toFixed(2)),
      maxWeight: parseFloat(maxWeight.toFixed(2)),
      minWeight: parseFloat(minWeight.toFixed(2)),
      totalWeight: record.totalWeight,
      targetWeight: targetWeight || record.weightLimit,
    };
  });

  // Рассчитываем общее снижение веса
  const initialWeight = chartData[0]?.totalWeight || 0;
  const currentWeight = chartData[chartData.length - 1]?.totalWeight || 0;
  const weightLoss = initialWeight - currentWeight;
  const weightLossPercent = initialWeight > 0 ? ((weightLoss / initialWeight) * 100).toFixed(1) : '0';

  // Проверяем достигнута ли цель
  const targetReached = targetWeight && currentWeight <= targetWeight;

  // Кастомный Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="glass rounded-2xl p-4 shadow-apple-lg border border-white/30">
          <p className="font-bold text-foreground mb-2">{data.checkpoint}</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Время:</span>
              <span className="font-semibold text-primary">{data.hours} ч</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Средний вес:</span>
              <span className="font-semibold text-foreground">{data.avgWeight} т</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Общий вес:</span>
              <span className="font-bold text-lg text-primary">{data.totalWeight} т</span>
            </div>
            {data.targetWeight && (
              <div className="flex justify-between gap-4 pt-2 border-t border-white/20">
                <span className="text-muted-foreground">Целевой:</span>
                <span className="font-semibold text-success">{data.targetWeight} т</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass rounded-3xl p-6 shadow-apple-md border border-white/20">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center shadow-apple-md">
            <TrendingDown className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">{t('weightProgressChart')}</h3>
            <p className="text-sm text-muted-foreground">{t('weightDynamics')}</p>
          </div>
        </div>

        {/* Stats Badge */}
        <div className={`glass rounded-2xl px-4 py-2 border ${
          targetReached 
            ? 'border-success/30 bg-success/10' 
            : 'border-primary/30 bg-primary/10'
        }`}>
          <div className="text-xs text-muted-foreground mb-0.5">{t('weightReduction')}</div>
          <div className={`text-xl font-bold ${targetReached ? 'text-success' : 'text-primary'}`}>
            -{weightLoss.toFixed(1)} т
          </div>
          <div className="text-xs text-muted-foreground">({weightLossPercent}%)</div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-80 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart 
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#007aff" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#007aff" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34c759" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#34c759" stopOpacity={0}/>
              </linearGradient>
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
            
            <XAxis 
              dataKey="hours" 
              stroke="#86868b"
              style={{ fontSize: '12px', fontWeight: 500 }}
              label={{ value: t('hoursFromStart'), position: 'insideBottom', offset: -5, style: { fontSize: '13px', fontWeight: 600, fill: '#1d1d1f' } }}
            />
            
            <YAxis 
              stroke="#86868b"
              style={{ fontSize: '12px', fontWeight: 500 }}
              label={{ value: t('weightTons'), angle: -90, position: 'insideLeft', style: { fontSize: '13px', fontWeight: 600, fill: '#1d1d1f' } }}
            />
            
            <Tooltip content={<CustomTooltip />} />
            
            <Legend 
              wrapperStyle={{ fontSize: '13px', fontWeight: 600, paddingTop: '10px' }}
              iconType="circle"
            />
            
            {/* Целевая линия */}
            {targetWeight && (
              <Line 
                type="monotone" 
                dataKey="targetWeight" 
                stroke="#34c759" 
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name={t('targetWeight')}
              />
            )}
            
            {/* Общий вес (area) */}
            <Area
              type="monotone"
              dataKey="totalWeight"
              stroke="#007aff"
              strokeWidth={3}
              fill="url(#colorTotal)"
              name={t('totalWeight')}
              dot={{ fill: '#007aff', strokeWidth: 2, r: 5 }}
              activeDot={{ r: 7, fill: '#007aff', stroke: '#fff', strokeWidth: 3 }}
            />
            
            {/* Средний вес */}
            <Line 
              type="monotone" 
              dataKey="avgWeight" 
              stroke="#ff9500" 
              strokeWidth={2}
              dot={{ fill: '#ff9500', strokeWidth: 2, r: 4 }}
              name={t('avgBoxWeight')}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend Info */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="glass rounded-xl p-3 border border-white/30">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-primary"></div>
            <span className="text-xs font-semibold text-muted-foreground">{t('totalWeight')}</span>
          </div>
          <p className="text-sm text-foreground">
            {t('sumOfAllBoxes')}
          </p>
        </div>

        <div className="glass rounded-xl p-3 border border-white/30">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-warning"></div>
            <span className="text-xs font-semibold text-muted-foreground">{t('avgBoxWeight')}</span>
          </div>
          <p className="text-sm text-foreground">
            {t('avgValue')}
          </p>
        </div>

        <div className="glass rounded-xl p-3 border border-white/30">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-success"></div>
            <span className="text-xs font-semibold text-muted-foreground">{t('targetWeight')}</span>
          </div>
          <p className="text-sm text-foreground">
            {t('acceptableLimit')}
          </p>
        </div>
      </div>

      {/* Status Message */}
      {targetReached && (
        <div className="mt-4 bg-success/10 border-2 border-success/30 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-success to-green-400 flex items-center justify-center shadow-apple-sm">
            <Scale className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-success">{t('targetReached')} 🎉</p>
            <p className="text-sm text-success/80">{t('readyForPacking')}</p>
          </div>
        </div>
      )}
    </div>
  );
}