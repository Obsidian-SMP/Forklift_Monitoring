import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard, DashboardGrid } from '@/components/dashboard/DashboardCard';
import { StatusIndicator, getThresholdStatus } from '@/components/dashboard/StatusIndicator';
import { Thermometer, Droplets } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DHTSensorWidget } from '@/components/DHTSensorWidget';
import { dhtService } from '@/services/api';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from 'recharts';
import { Button } from '@/components/ui/button';

type TimeRange = '1h' | '24h' | '7d';

const formatTimeByRange = (timestamp: string, range: TimeRange) => {
  const date = new Date(timestamp);
  if (range === '1h') {
    // Show time with seconds for 1-hour range (IST)
    return date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }
  if (range === '24h') {
    // Show time for 24-hour range (IST)
    return date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
  }
  // Show date for 7-day range (IST)
  return date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric' });
};

// Thresholds
const TEMP_WARNING_HIGH = 25;
const TEMP_DANGER_HIGH = 30;
const TEMP_WARNING_LOW = 15;
const TEMP_DANGER_LOW = 10;
const HUMIDITY_WARNING_HIGH = 60;
const HUMIDITY_DANGER_HIGH = 70;
const HUMIDITY_WARNING_LOW = 30;
const HUMIDITY_DANGER_LOW = 20;

export default function WarehouseEnvironment() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [dhtData, setDhtData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Fetch DHT data from API
  useEffect(() => {
    const fetchDHTHistory = async () => {
      try {
        setLoading(true);
        
        // Calculate hours based on time range
        const hoursMap: Record<TimeRange, number> = {
          '1h': 1,
          '24h': 24,
          '7d': 168
        };
        
        const hours = hoursMap[timeRange];
        
        // Fetch real historical data from database
        const response = await fetch(`http://10.136.57.165:5000/api/sensors/environment/history?hours=${hours}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch historical data');
        }
        
        const result = await response.json();
        
        if (result.data && result.data.length > 0) {
          // Format the historical data for charts
          const formattedData = result.data
            .reverse() // Oldest to newest
            .map((reading: any) => ({
              time: formatTimeByRange(reading.timestamp, timeRange),
              temperature: Number(reading.temperature.toFixed(1)),
              humidity: Number(reading.humidity.toFixed(1)),
              timestamp: reading.timestamp,
            }));
          
          setDhtData(formattedData);
        } else {
          // No data available - keep empty array
          setDhtData([]);
        }
      } catch (err) {
        console.error('Failed to fetch DHT history:', err);
        setDhtData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDHTHistory();
    
    // Refresh data every 60 seconds
    const interval = setInterval(fetchDHTHistory, 60000);
    return () => clearInterval(interval);
  }, [timeRange]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Warehouse Environment</h1>
            <p className="text-muted-foreground">Monitor temperature and humidity across zones</p>
          </div>
          <div className="flex items-center gap-2">
            {(['1h', '24h', '7d'] as TimeRange[]).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange(range)}
              >
                {range}
              </Button>
            ))}
          </div>
        </div>

        {/* Full Width DHT Sensor Widget */}
        <DHTSensorWidget />

        {/* Temperature Chart */}
        <DashboardCard 
          title="Temperature Trend" 
          description="With warning and danger thresholds"
          actions={
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-status-warning" />
                <span className="text-muted-foreground">Warning</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-status-danger" />
                <span className="text-muted-foreground">Danger</span>
              </div>
            </div>
          }
        >
          {loading ? (
            <div className="h-[220px] mt-4 flex items-center justify-center">
              <p className="text-muted-foreground">Loading data...</p>
            </div>
          ) : dhtData.length === 0 ? (
            <div className="h-[220px] mt-4 flex flex-col items-center justify-center">
              <Thermometer className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-lg font-medium text-foreground">No Historical Data Yet</p>
              <p className="text-sm text-muted-foreground mt-1">DHT11 readings are saved every 60 seconds</p>
              <p className="text-xs text-muted-foreground mt-1">Check back in a few minutes...</p>
            </div>
          ) : (
            <div className="h-[220px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dhtData}>
                <defs>
                  <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 11 }} 
                  className="text-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  domain={[5, 35]}
                  tick={{ fontSize: 11 }} 
                  className="text-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                  label={{ value: '°C', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <ReferenceLine y={TEMP_DANGER_HIGH} stroke="hsl(var(--status-danger))" strokeDasharray="5 5" />
                <ReferenceLine y={TEMP_WARNING_HIGH} stroke="hsl(var(--status-warning))" strokeDasharray="5 5" />
                <ReferenceLine y={TEMP_WARNING_LOW} stroke="hsl(var(--status-warning))" strokeDasharray="5 5" />
                <ReferenceLine y={TEMP_DANGER_LOW} stroke="hsl(var(--status-danger))" strokeDasharray="5 5" />
                <Area
                  type="monotone"
                  dataKey="temperature"
                  stroke="hsl(var(--chart-3))"
                  strokeWidth={2}
                  fill="url(#tempGradient)"
                  name="Temperature"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          )}
        </DashboardCard>

        {/* Humidity Chart */}
        <DashboardCard 
          title="Humidity Trend" 
          description="Relative humidity percentage"
        >
          {loading ? (
            <div className="h-[200px] mt-4 flex items-center justify-center">
              <p className="text-muted-foreground">Loading data...</p>
            </div>
          ) : dhtData.length === 0 ? (
            <div className="h-[200px] mt-4 flex flex-col items-center justify-center">
              <Droplets className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-lg font-medium text-foreground">No Historical Data Yet</p>
              <p className="text-sm text-muted-foreground mt-1">DHT11 readings are saved every 60 seconds</p>
              <p className="text-xs text-muted-foreground mt-1">Check back in a few minutes...</p>
            </div>
          ) : (
            <div className="h-[200px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dhtData}>
                <defs>
                  <linearGradient id="humidityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 11 }} 
                  className="text-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }} 
                  className="text-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                  label={{ value: '%', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <ReferenceLine y={HUMIDITY_DANGER_HIGH} stroke="hsl(var(--status-danger))" strokeDasharray="5 5" />
                <ReferenceLine y={HUMIDITY_WARNING_HIGH} stroke="hsl(var(--status-warning))" strokeDasharray="5 5" />
                <ReferenceLine y={HUMIDITY_WARNING_LOW} stroke="hsl(var(--status-warning))" strokeDasharray="5 5" />
                <ReferenceLine y={HUMIDITY_DANGER_LOW} stroke="hsl(var(--status-danger))" strokeDasharray="5 5" />
                <Area
                  type="monotone"
                  dataKey="humidity"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  fill="url(#humidityGradient)"
                  name="Humidity"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          )}
        </DashboardCard>

        {/* Threshold Status */}
        {dhtData.length > 0 && (
          <DashboardCard title="Threshold Status" description="Current readings vs defined thresholds">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              {/* Temperature thresholds */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Thermometer className="h-4 w-4" />
                  Temperature Thresholds
                </h4>
                <div className="space-y-2">
                  <ThresholdBar 
                    label="Current" 
                    value={dhtData[dhtData.length - 1].temperature} 
                    min={5} 
                    max={35}
                    warningLow={TEMP_WARNING_LOW}
                    warningHigh={TEMP_WARNING_HIGH}
                    dangerLow={TEMP_DANGER_LOW}
                    dangerHigh={TEMP_DANGER_HIGH}
                    unit="°C"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 rounded-lg bg-muted">
                    <div className="text-muted-foreground">Min Today</div>
                    <div className="font-semibold">{Math.min(...dhtData.map(d => d.temperature)).toFixed(1)}°C</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <div className="text-muted-foreground">Max Today</div>
                    <div className="font-semibold">{Math.max(...dhtData.map(d => d.temperature)).toFixed(1)}°C</div>
                  </div>
                </div>
              </div>

              {/* Humidity thresholds */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Droplets className="h-4 w-4" />
                  Humidity Thresholds
                </h4>
                <div className="space-y-2">
                  <ThresholdBar 
                    label="Current" 
                    value={dhtData[dhtData.length - 1].humidity} 
                    min={0} 
                    max={100}
                    warningLow={HUMIDITY_WARNING_LOW}
                    warningHigh={HUMIDITY_WARNING_HIGH}
                    dangerLow={HUMIDITY_DANGER_LOW}
                    dangerHigh={HUMIDITY_DANGER_HIGH}
                    unit="%"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 rounded-lg bg-muted">
                    <div className="text-muted-foreground">Min Today</div>
                    <div className="font-semibold">{Math.min(...dhtData.map(d => d.humidity)).toFixed(1)}%</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <div className="text-muted-foreground">Max Today</div>
                    <div className="font-semibold">{Math.max(...dhtData.map(d => d.humidity)).toFixed(1)}%</div>
                  </div>
                </div>
              </div>
            </div>
          </DashboardCard>
        )}
      </div>
    </DashboardLayout>
  );
}

// Threshold visualization bar
interface ThresholdBarProps {
  label: string;
  value: number;
  min: number;
  max: number;
  warningLow: number;
  warningHigh: number;
  dangerLow: number;
  dangerHigh: number;
  unit: string;
}

function ThresholdBar({ 
  label, 
  value, 
  min, 
  max, 
  warningLow, 
  warningHigh, 
  dangerLow, 
  dangerHigh,
  unit 
}: ThresholdBarProps) {
  const range = max - min;
  const valuePercent = ((value - min) / range) * 100;
  const warningLowPercent = ((warningLow - min) / range) * 100;
  const warningHighPercent = ((warningHigh - min) / range) * 100;
  const dangerLowPercent = ((dangerLow - min) / range) * 100;
  const dangerHighPercent = ((dangerHigh - min) / range) * 100;

  const status = 
    value < dangerLow || value > dangerHigh ? 'danger' :
    value < warningLow || value > warningHigh ? 'warning' : 'safe';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <StatusIndicator variant={status} label={`${value.toFixed(1)}${unit}`} />
      </div>
      <div className="relative h-3 rounded-full overflow-hidden bg-muted">
        {/* Danger zones */}
        <div 
          className="absolute h-full bg-status-danger/30" 
          style={{ left: 0, width: `${dangerLowPercent}%` }}
        />
        <div 
          className="absolute h-full bg-status-danger/30" 
          style={{ left: `${dangerHighPercent}%`, right: 0 }}
        />
        {/* Warning zones */}
        <div 
          className="absolute h-full bg-status-warning/30" 
          style={{ left: `${dangerLowPercent}%`, width: `${warningLowPercent - dangerLowPercent}%` }}
        />
        <div 
          className="absolute h-full bg-status-warning/30" 
          style={{ left: `${warningHighPercent}%`, width: `${dangerHighPercent - warningHighPercent}%` }}
        />
        {/* Safe zone */}
        <div 
          className="absolute h-full bg-status-safe/30" 
          style={{ left: `${warningLowPercent}%`, width: `${warningHighPercent - warningLowPercent}%` }}
        />
        {/* Current value indicator */}
        <div 
          className={cn(
            "absolute top-0 bottom-0 w-1 rounded-full",
            status === 'safe' && 'bg-status-safe',
            status === 'warning' && 'bg-status-warning',
            status === 'danger' && 'bg-status-danger'
          )}
          style={{ left: `${Math.min(Math.max(valuePercent, 0), 100)}%`, transform: 'translateX(-50%)' }}
        />
      </div>
    </div>
  );
}
