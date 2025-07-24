#!/usr/bin/env python3
"""
Quartzy Performance Monitoring Script
Monitors system performance and provides optimization recommendations
"""

import psutil
import time
import requests
import json
from datetime import datetime
import argparse

class PerformanceMonitor:
    def __init__(self, api_url="http://localhost:8000", frontend_url="http://localhost:3000"):
        self.api_url = api_url
        self.frontend_url = frontend_url
        self.metrics = {}
        
    def check_system_resources(self):
        """Check system CPU, memory, and disk usage"""
        print("🔍 Checking system resources...")
        
        # CPU usage
        cpu_percent = psutil.cpu_percent(interval=1)
        
        # Memory usage
        memory = psutil.virtual_memory()
        
        # Disk usage
        disk = psutil.disk_usage('/')
        
        # Network I/O
        network = psutil.net_io_counters()
        
        self.metrics['system'] = {
            'cpu_percent': cpu_percent,
            'memory_percent': memory.percent,
            'memory_available_gb': memory.available / (1024**3),
            'disk_percent': disk.percent,
            'network_bytes_sent': network.bytes_sent,
            'network_bytes_recv': network.bytes_recv,
            'timestamp': datetime.now().isoformat()
        }
        
        print(f"   CPU: {cpu_percent}%")
        print(f"   Memory: {memory.percent}% ({memory.available / (1024**3):.1f}GB available)")
        print(f"   Disk: {disk.percent}%")
        
        # Warnings
        if cpu_percent > 80:
            print("   ⚠️  High CPU usage detected!")
        if memory.percent > 80:
            print("   ⚠️  High memory usage detected!")
        if disk.percent > 90:
            print("   ⚠️  Low disk space!")
            
    def check_database_performance(self):
        """Check database connection and query performance"""
        print("🗄️  Checking database performance...")
        
        try:
            # Test API response time
            start_time = time.time()
            response = requests.get(f"{self.api_url}/api/items/", timeout=10)
            response_time = (time.time() - start_time) * 1000
            
            self.metrics['database'] = {
                'response_time_ms': response_time,
                'status_code': response.status_code,
                'timestamp': datetime.now().isoformat()
            }
            
            print(f"   API Response Time: {response_time:.2f}ms")
            
            if response_time > 1000:
                print("   ⚠️  Slow API response time!")
            elif response_time > 500:
                print("   ⚠️  Moderate API response time")
            else:
                print("   ✅ Good API response time")
                
        except requests.exceptions.RequestException as e:
            print(f"   ❌ Database/API connection failed: {e}")
            self.metrics['database'] = {
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
            
    def check_frontend_performance(self):
        """Check frontend loading performance"""
        print("🎨 Checking frontend performance...")
        
        try:
            start_time = time.time()
            response = requests.get(self.frontend_url, timeout=10)
            load_time = (time.time() - start_time) * 1000
            
            self.metrics['frontend'] = {
                'load_time_ms': load_time,
                'status_code': response.status_code,
                'content_size_kb': len(response.content) / 1024,
                'timestamp': datetime.now().isoformat()
            }
            
            print(f"   Frontend Load Time: {load_time:.2f}ms")
            print(f"   Content Size: {len(response.content) / 1024:.1f}KB")
            
            if load_time > 3000:
                print("   ⚠️  Slow frontend loading!")
            elif load_time > 1500:
                print("   ⚠️  Moderate frontend loading time")
            else:
                print("   ✅ Good frontend loading time")
                
        except requests.exceptions.RequestException as e:
            print(f"   ❌ Frontend connection failed: {e}")
            self.metrics['frontend'] = {
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def check_processes(self):
        """Check running processes related to the application"""
        print("⚙️  Checking application processes...")
        
        django_processes = []
        node_processes = []
        
        for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'cpu_percent', 'memory_percent']):
            try:
                if 'python' in proc.info['name'] and any('manage.py' in arg for arg in proc.info['cmdline']):
                    django_processes.append(proc.info)
                elif 'node' in proc.info['name'] and any('react-scripts' in arg for arg in proc.info['cmdline']):
                    node_processes.append(proc.info)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        
        self.metrics['processes'] = {
            'django_processes': len(django_processes),
            'node_processes': len(node_processes),
            'timestamp': datetime.now().isoformat()
        }
        
        print(f"   Django processes: {len(django_processes)}")
        print(f"   Node.js processes: {len(node_processes)}")
        
        if len(django_processes) == 0:
            print("   ⚠️  No Django processes found!")
        if len(node_processes) == 0:
            print("   ⚠️  No Node.js processes found!")
    
    def generate_recommendations(self):
        """Generate performance optimization recommendations"""
        print("\n📊 Performance Analysis & Recommendations:")
        
        recommendations = []
        
        # System recommendations
        if self.metrics.get('system', {}).get('cpu_percent', 0) > 80:
            recommendations.append("• High CPU usage: Consider optimizing database queries or adding caching")
        
        if self.metrics.get('system', {}).get('memory_percent', 0) > 80:
            recommendations.append("• High memory usage: Review application for memory leaks or increase server memory")
        
        # Database recommendations
        db_time = self.metrics.get('database', {}).get('response_time_ms', 0)
        if db_time > 1000:
            recommendations.append("• Slow database: Add database indexes, optimize queries, or consider connection pooling")
        elif db_time > 500:
            recommendations.append("• Moderate database performance: Review slow queries and consider caching")
        
        # Frontend recommendations
        frontend_time = self.metrics.get('frontend', {}).get('load_time_ms', 0)
        if frontend_time > 3000:
            recommendations.append("• Slow frontend: Enable compression, optimize bundle size, add CDN")
        elif frontend_time > 1500:
            recommendations.append("• Moderate frontend performance: Consider code splitting and lazy loading")
        
        content_size = self.metrics.get('frontend', {}).get('content_size_kb', 0)
        if content_size > 1000:
            recommendations.append("• Large frontend bundle: Enable gzip compression and optimize assets")
        
        # Process recommendations
        if self.metrics.get('processes', {}).get('django_processes', 0) == 0:
            recommendations.append("• Django not running: Start the Django development server")
        
        if self.metrics.get('processes', {}).get('node_processes', 0) == 0:
            recommendations.append("• Frontend not running: Start the React development server")
        
        if not recommendations:
            recommendations.append("• System performance looks good! 🎉")
        
        for rec in recommendations:
            print(f"  {rec}")
    
    def save_metrics(self, filename):
        """Save metrics to JSON file"""
        with open(filename, 'w') as f:
            json.dump(self.metrics, f, indent=2)
        print(f"\n💾 Metrics saved to {filename}")
    
    def run_full_check(self, save_file=None):
        """Run all performance checks"""
        print("🚀 Starting Quartzy Performance Check...\n")
        
        self.check_system_resources()
        print()
        self.check_database_performance()
        print()
        self.check_frontend_performance()
        print()
        self.check_processes()
        
        self.generate_recommendations()
        
        if save_file:
            self.save_metrics(save_file)
        
        print("\n✅ Performance check completed!")

def main():
    parser = argparse.ArgumentParser(description='Quartzy Performance Monitor')
    parser.add_argument('--api-url', default='http://localhost:8000', 
                       help='Backend API URL (default: http://localhost:8000)')
    parser.add_argument('--frontend-url', default='http://localhost:3000',
                       help='Frontend URL (default: http://localhost:3000)')
    parser.add_argument('--save', type=str, help='Save metrics to JSON file')
    parser.add_argument('--continuous', action='store_true', 
                       help='Run continuous monitoring (every 60 seconds)')
    
    args = parser.parse_args()
    
    monitor = PerformanceMonitor(args.api_url, args.frontend_url)
    
    if args.continuous:
        print("🔄 Starting continuous monitoring (Ctrl+C to stop)...")
        try:
            while True:
                monitor.run_full_check(args.save)
                print("\n⏰ Waiting 60 seconds for next check...\n" + "="*50 + "\n")
                time.sleep(60)
        except KeyboardInterrupt:
            print("\n🛑 Monitoring stopped by user")
    else:
        monitor.run_full_check(args.save)

if __name__ == "__main__":
    main()