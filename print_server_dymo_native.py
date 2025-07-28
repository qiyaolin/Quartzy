#!/usr/bin/env python3
"""
DYMO Native Print Server - 基于DYMO Connect Web Service的后台自动打印

这个实现直接调用DYMO Connect的REST API，模拟前端JavaScript的打印逻辑
不需要打开浏览器或DYMO Label软件界面，实现真正的后台自动打印

Requirements:
- DYMO Connect软件必须运行（提供Web Service）
- Python 3.7+
- requests库

Usage:
    python print_server_dymo_native.py --config print_server_config.json
"""

import os
import sys
import time
import json
import logging
import argparse
import requests
import platform
from datetime import datetime, timedelta
from typing import Dict, Optional, Any, List
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('print_server_native.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class DymoNativeConnector:
    """直接调用DYMO Connect Web Service的打印连接器"""
    
    def __init__(self, config):
        self.config = config
        self.printer_name = config.get('printer_name')
        self.dymo_service_url = "http://localhost:41951"  # DYMO Connect默认端口
        self._service_available = False
        self._available_printers = []
        
        # 检查DYMO Connect服务
        self._check_dymo_service()
    
    def _check_dymo_service(self) -> bool:
        """检查DYMO Connect Web Service是否可用"""
        try:
            logger.info("检查DYMO Connect Web Service...")
            
            # 检查服务状态
            response = requests.get(
                f"{self.dymo_service_url}/DYMO/DLS/Printing/StatusConnected", 
                timeout=5
            )
            
            if response.status_code == 200:
                logger.info("DYMO Connect Web Service运行正常")
                self._service_available = True
                
                # 获取可用打印机
                self._get_available_printers()
                return True
            else:
                logger.error(f"DYMO Connect服务响应异常: {response.status_code}")
                return False
                
        except requests.exceptions.ConnectionError:
            logger.error("无法连接到DYMO Connect Web Service")
            logger.error("请确保DYMO Connect软件正在运行")
            return False
        except Exception as e:
            logger.error(f"检查DYMO服务时出错: {e}")
            return False
    
    def _get_available_printers(self):
        """获取可用的DYMO打印机列表"""
        try:
            logger.info("获取可用打印机列表...")
            
            response = requests.get(
                f"{self.dymo_service_url}/DYMO/DLS/Printing/GetPrinters",
                timeout=10
            )
            
            if response.status_code == 200:
                try:
                    # DYMO API返回的可能是JSON数组或XML，需要处理
                    content_type = response.headers.get('content-type', '').lower()
                    
                    if 'application/json' in content_type:
                        printers = response.json() if response.text.strip() else []
                    else:
                        # 如果是XML或其他格式，尝试解析
                        printers_text = response.text.strip()
                        if printers_text.startswith('[') and printers_text.endswith(']'):
                            printers = json.loads(printers_text)
                        else:
                            # 简单的文本解析
                            printers = [line.strip() for line in printers_text.split('\n') if line.strip()]
                    
                    self._available_printers = printers
                    logger.info(f"找到 {len(printers)} 台打印机:")
                    for i, printer in enumerate(printers):
                        printer_name = printer if isinstance(printer, str) else printer.get('Name', str(printer))
                        logger.info(f"  {i+1}. {printer_name}")
                    
                    # 自动选择打印机
                    if not self.printer_name and printers:
                        # 优先选择包含DYMO的打印机
                        for printer in printers:
                            printer_name = printer if isinstance(printer, str) else printer.get('Name', str(printer))
                            if 'dymo' in printer_name.lower():
                                self.printer_name = printer_name
                                logger.info(f"自动选择DYMO打印机: {self.printer_name}")
                                break
                        
                        # 如果没有找到DYMO打印机，使用第一个
                        if not self.printer_name:
                            first_printer = printers[0]
                            self.printer_name = first_printer if isinstance(first_printer, str) else first_printer.get('Name', str(first_printer))
                            logger.info(f"使用第一个可用打印机: {self.printer_name}")
                    
                except (json.JSONDecodeError, ValueError) as e:
                    logger.error(f"解析打印机列表失败: {e}")
                    logger.error(f"原始响应: {response.text}")
                    self._available_printers = []
            else:
                logger.error(f"获取打印机列表失败: {response.status_code}")
                logger.error(f"响应内容: {response.text}")
                
        except Exception as e:
            logger.error(f"获取打印机列表时出错: {e}")
    
    def get_printer_status(self) -> Dict[str, str]:
        """获取打印机状态"""
        if not self._service_available:
            return {'status': 'service_unavailable', 'message': 'DYMO Connect服务不可用'}
        
        if not self._available_printers:
            return {'status': 'no_printers', 'message': '未找到可用打印机'}
        
        if not self.printer_name:
            return {'status': 'no_printer_selected', 'message': '未选择打印机'}
        
        return {'status': 'ready', 'message': f'打印机 {self.printer_name} 就绪'}
    
    def print_label(self, label_data: Dict[str, Any]) -> bool:
        """使用DYMO Connect Web Service打印标签"""
        if not self._service_available:
            raise Exception("DYMO Connect服务不可用")
        
        if not self.printer_name:
            raise Exception("未指定打印机")
        
        try:
            logger.info(f"开始打印标签到 {self.printer_name}")
            
            # 创建标签XML - 基于前端BarcodeComponent的实现
            label_xml = self._create_label_xml(label_data)
            
            # 准备打印请求数据
            print_request = {
                'printerName': self.printer_name,
                'printParamsXml': '',  # 使用默认打印参数
                'labelXml': label_xml,
                'labelSetXml': ''  # 不使用标签集
            }
            
            logger.info(f"发送打印请求到DYMO Connect...")
            logger.debug(f"打印机: {self.printer_name}")
            logger.debug(f"标签数据: {label_data}")
            
            # 调用DYMO Connect的打印API
            response = requests.post(
                f"{self.dymo_service_url}/DYMO/DLS/Printing/PrintLabel",
                json=print_request,
                headers={
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout=30
            )
            
            logger.info(f"打印API响应状态: {response.status_code}")
            logger.debug(f"响应内容: {response.text}")
            
            if response.status_code == 200:
                logger.info("标签打印成功!")
                return True
            else:
                error_msg = f"打印失败: HTTP {response.status_code}"
                if response.text:
                    error_msg += f" - {response.text}"
                logger.error(error_msg)
                raise Exception(error_msg)
                
        except requests.exceptions.Timeout:
            error_msg = "打印请求超时"
            logger.error(error_msg)
            raise Exception(error_msg)
        except requests.exceptions.ConnectionError:
            error_msg = "无法连接到DYMO Connect服务"
            logger.error(error_msg)
            raise Exception(error_msg)
        except Exception as e:
            logger.error(f"打印过程中出错: {e}")
            raise
    
    def _create_label_xml(self, label_data: Dict[str, Any]) -> str:
        """创建DYMO标签XML - 基于前端实现"""
        item_name = label_data.get('itemName', '')
        barcode = label_data.get('barcode', '')
        custom_text = label_data.get('customText', item_name)
        font_size = label_data.get('fontSize', 8)
        is_bold = label_data.get('isBold', False)
        
        # 使用与前端BarcodeComponent相同的标签模板
        label_xml = f'''<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips" MediaType="Default">
    <PaperOrientation>Portrait</PaperOrientation>
    <Id>Small30334</Id>
    <IsOutlined>false</IsOutlined>
    <PaperName>30334 2-1/4 in x 1-1/4 in</PaperName>
    <DrawCommands>
        <RoundRectangle X="0" Y="0" Width="3240" Height="1800" Rx="270" Ry="270" />
    </DrawCommands>
    <ObjectInfo>
        <TextObject>
            <Name>textbox</Name>
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
            <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
            <LinkedObjectName />
            <Rotation>Rotation0</Rotation>
            <IsMirrored>False</IsMirrored>
            <IsVariable>False</IsVariable>
            <GroupID>-1</GroupID>
            <IsOutlined>False</IsOutlined>
            <HorizontalAlignment>Center</HorizontalAlignment>
            <VerticalAlignment>Top</VerticalAlignment>
            <TextFitMode>ShrinkToFit</TextFitMode>
            <UseFullFontHeight>True</UseFullFontHeight>
            <Verticalized>False</Verticalized>
            <StyledText>
                <Element>
                    <String xml:space="preserve">{custom_text}</String>
                    <Attributes>
                        <Font Family="Arial" Size="{font_size}" Bold="{'True' if is_bold else 'False'}" Italic="False" Underline="False" Strikeout="False" />
                        <ForeColor Alpha="255" Red="0" Green="0" Blue="0" HueScale="100" />
                    </Attributes>
                </Element>
            </StyledText>
        </TextObject>
        <Bounds X="58" Y="86" Width="3125" Height="765" />
    </ObjectInfo>
    <ObjectInfo>
        <BarcodeObject>
            <Name>labelbox</Name>
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
            <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
            <LinkedObjectName />
            <Rotation>Rotation0</Rotation>
            <IsMirrored>False</IsMirrored>
            <IsVariable>True</IsVariable>
            <GroupID>-1</GroupID>
            <IsOutlined>False</IsOutlined>
            <Text>{barcode}</Text>
            <Type>Code128Auto</Type>
            <Size>Small</Size>
            <TextPosition>None</TextPosition>
            <TextFont Family="Arial" Size="8" Bold="False" Italic="False" Underline="False" Strikeout="False" />
            <CheckSumFont Family="Arial" Size="8" Bold="False" Italic="False" Underline="False" Strikeout="False" />
            <TextEmbedding>None</TextEmbedding>
            <ECLevel>0</ECLevel>
            <HorizontalAlignment>Center</HorizontalAlignment>
            <QuietZonesPadding Left="0" Top="0" Right="0" Bottom="0" />
        </BarcodeObject>
        <Bounds X="58" Y="948.5" Width="3125" Height="607" />
    </ObjectInfo>
</DieCutLabel>'''
        
        return label_xml


# 导入原有的配置和服务器类
from print_server import PrintServerConfig, PrintServer

class DymoNativePrintServer(PrintServer):
    """使用DYMO Native API的打印服务器"""
    
    def __init__(self, config: PrintServerConfig):
        super().__init__(config)
        # 替换DYMO连接器为原生实现
        self.dymo = DymoNativeConnector(config)
    
    def run(self):
        """主服务器循环"""
        logger.info(f"启动DYMO原生打印服务器 {self.config.get('server_id')}")
        logger.info(f"后端URL: {self.config.get('backend_url')}")
        logger.info(f"轮询间隔: {self.config.get('poll_interval')} 秒")
        
        # 检查DYMO服务状态
        status = self.dymo.get_printer_status()
        logger.info(f"打印机状态: {status['message']}")
        
        if status['status'] != 'ready':
            logger.error("打印机未就绪，请检查DYMO Connect服务和打印机连接")
            logger.error("确保:")
            logger.error("1. DYMO Connect软件正在运行")
            logger.error("2. DYMO打印机已连接并开启")
            logger.error("3. 打印机驱动已正确安装")
            return
        
        # 向后端注册服务器
        if not self.register_server():
            logger.error("无法向后端注册服务器，退出")
            return
        
        # 主循环
        try:
            while True:
                try:
                    # 定期发送心跳
                    if (datetime.now() - self.last_heartbeat).seconds >= self.config.get('heartbeat_interval', 60):
                        self.send_heartbeat()
                    
                    # 获取并处理打印任务
                    job = self.fetch_pending_job()
                    if job:
                        logger.info(f"收到打印任务: {job.get('id')}")
                        self.process_job(job)
                    else:
                        logger.debug("暂无待处理任务")
                    
                    # 等待下次轮询
                    time.sleep(self.config.get('poll_interval', 5))
                    
                except KeyboardInterrupt:
                    logger.info("收到中断信号，正在关闭服务器...")
                    break
                except Exception as e:
                    logger.error(f"主循环出错: {e}")
                    time.sleep(self.config.get('retry_delay', 10))
        
        finally:
            logger.info("DYMO原生打印服务器已关闭")


def main():
    """主入口点"""
    parser = argparse.ArgumentParser(description='DYMO原生打印服务器')
    parser.add_argument('--config', '-c', help='配置文件路径', default='print_server_config.json')
    parser.add_argument('--debug', '-d', action='store_true', help='启用调试日志')
    parser.add_argument('--test', '-t', action='store_true', help='测试模式')
    
    args = parser.parse_args()
    
    # 设置日志级别
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # 测试模式
    if args.test:
        logger.info("运行测试模式...")
        config = PrintServerConfig(args.config)
        dymo = DymoNativeConnector(config)
        
        status = dymo.get_printer_status()
        logger.info(f"测试结果: {status['message']}")
        
        if status['status'] == 'ready':
            # 测试打印
            test_label = {
                'itemName': 'TEST ITEM',
                'barcode': 'TEST123456',
                'customText': 'Test Label',
                'fontSize': 8,
                'isBold': False
            }
            
            try:
                logger.info("测试打印标签...")
                success = dymo.print_label(test_label)
                if success:
                    logger.info("✅ 测试打印成功!")
                else:
                    logger.error("❌ 测试打印失败")
            except Exception as e:
                logger.error(f"❌ 测试打印出错: {e}")
        
        return
    
    # 正常运行模式
    config = PrintServerConfig(args.config)
    
    # 验证配置
    if not config.validate():
        logger.error("配置无效，退出")
        sys.exit(1)
    
    # 创建并运行服务器
    server = DymoNativePrintServer(config)
    server.run()


if __name__ == '__main__':
    main()