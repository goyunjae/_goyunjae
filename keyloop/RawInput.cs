using System;
using System.Runtime.InteropServices;

namespace KeyLoop {
internal static class RawInput {
    [StructLayout(LayoutKind.Sequential)] internal struct Device {
        internal ushort page, usage;
        internal uint flags;
        internal IntPtr window;
    }
    [StructLayout(LayoutKind.Sequential)] internal struct Header {
        internal uint type, size;
        internal IntPtr device, wParam;
    }
    [StructLayout(LayoutKind.Sequential)] internal struct Keyboard {
        internal ushort scan, flags, reserved, vk;
        internal uint message, extra;
    }
    [DllImport("user32.dll", SetLastError=true)] static extern bool RegisterRawInputDevices(Device[] devices,uint count,uint size);
    [DllImport("user32.dll", SetLastError=true)] static extern uint GetRawInputData(IntPtr handle,uint command,IntPtr data,ref uint size,uint headerSize);
    [DllImport("user32.dll")] static extern uint MapVirtualKey(uint code,uint type);
    internal static bool Register(IntPtr window) {
        return RegisterRawInputDevices(new[]{new Device {page=1,usage=6,flags=0x100,window=window}},1,(uint)Marshal.SizeOf(typeof(Device)));
    }
    internal static bool Remove() {
        return RegisterRawInputDevices(new[]{new Device {page=1,usage=6,flags=1,window=IntPtr.Zero}},1,(uint)Marshal.SizeOf(typeof(Device)));
    }
    internal static bool Read(IntPtr handle,out Keyboard keyboard,out int error) {
        keyboard=new Keyboard();error=0;
        uint size=0, headerSize=(uint)Marshal.SizeOf(typeof(Header));
        if(GetRawInputData(handle,0x10000003,IntPtr.Zero,ref size,headerSize)==uint.MaxValue) {error=Marshal.GetLastWin32Error();return false;}
        if(size<headerSize+16 || size>4096) {error=-1;return false;}
        IntPtr buffer=Marshal.AllocHGlobal((int)size);
        try {
            uint read=GetRawInputData(handle,0x10000003,buffer,ref size,headerSize);
            if(read==uint.MaxValue || read<headerSize+16) {error=Marshal.GetLastWin32Error();return false;}
            var header=(Header)Marshal.PtrToStructure(buffer,typeof(Header));
            if(header.type!=1) return false;
            keyboard=(Keyboard)Marshal.PtrToStructure(IntPtr.Add(buffer,(int)headerSize),typeof(Keyboard));return true;
        } finally {Marshal.FreeHGlobal(buffer);}
    }
    internal static KeyEvent Decode(Keyboard key,int at) {
        // E1 (Pause) needs special sequencing. Do not replay it as an ordinary key.
        if(key.vk==0 || key.vk>=255 || key.scan==0xff || (key.flags&4)!=0) return null;
        if(key.message!=0x100 && key.message!=0x101 && key.message!=0x104 && key.message!=0x105) return null;
        int scan=key.scan, vk=key.vk; bool extended=(key.flags&2)!=0;
        if(scan==0) {uint mapped=MapVirtualKey(key.vk,4);scan=(int)(mapped&0xff);extended=extended || (mapped&0xff00)==0xe000;}
        if(scan<1 || scan>255) return null;
        if(vk==0x10) vk=scan==0x36 ? 0xa1 : 0xa0;
        if(vk==0x11) vk=extended ? 0xa3 : 0xa2;
        if(vk==0x12) vk=extended ? 0xa5 : 0xa4;
        return new KeyEvent {AtMs=at,Vk=vk,Scan=scan,Extended=extended,Up=(key.flags&1)!=0};
    }
}
}
