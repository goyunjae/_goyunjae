using System;
using System.Runtime.InteropServices;
using System.Text;

namespace KeyLoop {
internal static class Native {
    internal delegate IntPtr HookProc(int code, IntPtr message, IntPtr data);
    [StructLayout(LayoutKind.Sequential)] internal struct HookKey {
        internal uint vk, scan, flags, time; internal UIntPtr extra;
    }
    [StructLayout(LayoutKind.Sequential)] internal struct KeyboardInput {
        internal ushort vk, scan; internal uint flags, time; internal UIntPtr extra;
    }
    [StructLayout(LayoutKind.Sequential)] internal struct MouseInput {
        internal int x, y; internal uint data, flags, time; internal UIntPtr extra;
    }
    [StructLayout(LayoutKind.Explicit)] internal struct InputUnion {
        [FieldOffset(0)] internal KeyboardInput keyboard;
        [FieldOffset(0)] internal MouseInput mouse;
    }
    [StructLayout(LayoutKind.Sequential)] internal struct Input {
        internal uint type; internal InputUnion value;
    }
    [DllImport("user32.dll", SetLastError=true)] internal static extern IntPtr SetWindowsHookEx(int id, HookProc proc, IntPtr module, uint thread);
    [DllImport("user32.dll")] internal static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] internal static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr message, IntPtr data);
    [DllImport("kernel32.dll", CharSet=CharSet.Auto)] internal static extern IntPtr GetModuleHandle(string name);
    [DllImport("user32.dll", SetLastError=true)] internal static extern uint SendInput(uint count, Input[] inputs, int size);
    [DllImport("user32.dll")] internal static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] internal static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] internal static extern int GetWindowText(IntPtr window, StringBuilder title, int count);
    [DllImport("user32.dll")] internal static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll")] internal static extern bool RegisterHotKey(IntPtr window, int id, uint modifiers, uint key);
    [DllImport("user32.dll")] internal static extern bool UnregisterHotKey(IntPtr window, int id);
    [DllImport("user32.dll")] internal static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] internal static extern IntPtr FindWindow(string className,string windowName);
    [DllImport("user32.dll")] internal static extern bool PostMessage(IntPtr window,uint message,IntPtr wParam,IntPtr lParam);
    [DllImport("user32.dll")] internal static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] internal static extern bool ShowWindow(IntPtr window,int command);
    internal static string Title(IntPtr window) {
        var title = new StringBuilder(256); GetWindowText(window, title, title.Capacity); return title.ToString();
    }
    internal static bool Send(KeyEvent e, bool scanMode) {
        var input = new Input(); input.type = 1;
        input.value.keyboard = new KeyboardInput {
            vk = (ushort)(scanMode ? 0 : e.Vk), scan = (ushort)(scanMode ? e.Scan : 0),
            flags = (uint)((scanMode ? 8 : 0) | (e.Up ? 2 : 0) | (e.Extended ? 1 : 0))
        };
        return SendInput(1, new [] { input }, Marshal.SizeOf(typeof(Input))) == 1;
    }
}
}
