import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import {
  Thermometer,
  Truck,
  Package,
  MapPin,
  AlertTriangle,
  Wifi,
} from 'lucide-react';

const navigationCards = [
  {
    title: 'Warehouse Environment',
    description: 'Monitor temperature, humidity and environmental conditions',
    icon: Thermometer,
    url: '/environment',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    title: 'Forklift Monitoring',
    description: 'Track forklift locations, status and camera feeds',
    icon: Truck,
    url: '/forklifts',
    gradient: 'from-orange-500 to-red-500',
  },
  {
    title: 'Inventory Management',
    description: 'View and manage warehouse inventory items',
    icon: Package,
    url: '/inventory',
    gradient: 'from-purple-500 to-pink-500',
  },
  {
    title: 'Path Tracking',
    description: 'Analyze forklift movement patterns and paths',
    icon: MapPin,
    url: '/tracking',
    gradient: 'from-green-500 to-emerald-500',
  },
  {
    title: 'RSSI Monitor',
    description: 'Configure BLE gateways and monitor signal strength',
    icon: Wifi,
    url: '/rssi',
    gradient: 'from-indigo-500 to-blue-500',
  },
  {
    title: 'Alerts & Events',
    description: 'View system alerts and configure notifications',
    icon: AlertTriangle,
    url: '/alerts',
    gradient: 'from-yellow-500 to-orange-500',
  },
];

export default function Overview() {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
        {/* Background with overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted/20" />
        <div 
          className="absolute inset-0 opacity-5 dark:opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        {/* Content */}
        <div className="relative z-10 container mx-auto px-6 py-12">
          {/* Hero Section */}
          <div className="text-center mb-16 space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold text-foreground">
              Warehouse IoT
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              Real-time inventory and forklift monitoring system
            </p>
            <div className="h-1 w-24 bg-gradient-to-r from-primary/50 via-primary to-primary/50 mx-auto rounded-full" />
          </div>

          {/* Navigation Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {navigationCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card
                  key={card.url}
                  className="group cursor-pointer transition-all duration-300 hover:shadow-2xl hover:scale-105 border-2 hover:border-primary/50 bg-card/80 backdrop-blur-sm overflow-hidden"
                  onClick={() => navigate(card.url)}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center text-center space-y-4">
                      {/* Icon with gradient background */}
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${card.gradient} p-0.5 transition-transform duration-300 group-hover:rotate-6`}>
                        <div className="w-full h-full rounded-2xl bg-card flex items-center justify-center">
                          <Icon className="h-8 w-8 text-foreground" />
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                        {card.title}
                      </h3>

                      {/* Description */}
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {card.description}
                      </p>

                      {/* Hover indicator */}
                      <div className="pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs font-medium text-primary">
                          Click to explore →
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Footer */}
          <div className="text-center mt-16 space-y-2">
            <p className="text-sm text-muted-foreground">
              Powered by IoT sensors, BLE tracking, and computer vision
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/60">
              <span>ESP32-CAM</span>
              <span>•</span>
              <span>DHT11 Sensors</span>
              <span>•</span>
              <span>BLE Gateways</span>
              <span>•</span>
              <span>YOLOv8</span>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
