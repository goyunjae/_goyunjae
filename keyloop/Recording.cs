using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Web.Script.Serialization;

namespace KeyLoop {
public sealed class KeyEvent {
    public int AtMs {get;set;}
    public int Vk {get;set;}
    public int Scan {get;set;}
    public bool Up {get;set;}
    public bool Extended {get;set;}
    public string Identity { get { return Vk + ":" + Scan + ":" + Extended; } }
    internal KeyEvent Release(int at) { return new KeyEvent {AtMs=at,Vk=Vk,Scan=Scan,Up=true,Extended=Extended}; }
}
public sealed class Recording {
    public int Version {get;set;}
    public int DurationMs {get;set;}
    public List<KeyEvent> Events {get;set;}
    public Recording() { Version=1; Events=new List<KeyEvent>(); }
    internal static bool Reserved(int vk) { return vk>=0x77 && vk<=0x79; }
    internal void Validate() {
        if (Version!=1 || DurationMs<100 || DurationMs>3600000 || Events==null || Events.Count==0 || Events.Count>200000)
            throw new InvalidDataException("녹화 길이 또는 이벤트 수가 올바르지 않습니다.");
        int previous=-1; var held=new HashSet<string>();
        foreach(var e in Events) {
            if(e==null || e.AtMs<previous || e.AtMs>DurationMs || e.Vk<1 || e.Vk>254 || e.Scan<1 || e.Scan>255 || Reserved(e.Vk))
                throw new InvalidDataException("지원하지 않는 키 또는 잘못된 시간 순서입니다.");
            previous=e.AtMs;
            if(e.Up) {
                if(!held.Remove(e.Identity)) throw new InvalidDataException("누르지 않은 키의 해제 이벤트가 있습니다.");
            } else held.Add(e.Identity);
        }
        if(held.Count>0) throw new InvalidDataException("해제되지 않은 키가 있습니다.");
    }
    internal static Recording Read(string path) {
        if(new FileInfo(path).Length>24000000) throw new InvalidDataException("파일 크기는 24 MB 이하여야 합니다.");
        var serializer=new JavaScriptSerializer { MaxJsonLength=24000000, RecursionLimit=32 };
        var result=serializer.Deserialize<Recording>(File.ReadAllText(path, Encoding.UTF8));
        if(result==null) throw new InvalidDataException("빈 녹화 파일입니다.");
        result.Validate(); return result;
    }
    internal void Write(string path) {
        Validate(); var serializer=new JavaScriptSerializer { MaxJsonLength=24000000 };
        File.WriteAllText(path, serializer.Serialize(this),new UTF8Encoding(false));
    }
}
internal static class SelfTest {
    static void Assert(bool yes, string message) { if(!yes) throw new Exception(message); }
    static void Reject(Recording r) {
        try { r.Validate(); } catch(InvalidDataException) { return; }
        throw new Exception("Invalid recording accepted");
    }
    internal static int Run() {
        try {
            Assert(System.Runtime.InteropServices.Marshal.SizeOf(typeof(Native.Input)) == (IntPtr.Size==8 ? 40 : 28),"INPUT ABI layout");
            var r=new Recording {DurationMs=1200};
            r.Events.Add(new KeyEvent {AtMs=100,Vk=65,Scan=30});
            r.Events.Add(new KeyEvent {AtMs=200,Vk=65,Scan=30});
            r.Events.Add(new KeyEvent {AtMs=700,Vk=66,Scan=48});
            r.Events.Add(new KeyEvent {AtMs=800,Vk=65,Scan=30,Up=true});
            r.Events.Add(new KeyEvent {AtMs=1100,Vk=66,Scan=48,Up=true});
            r.Validate();
            string file=Path.GetTempFileName();
            try { r.Write(file); var copy=Recording.Read(file); Assert(copy.Events.Count==5 && copy.DurationMs==1200,"JSON roundtrip"); } finally {File.Delete(file);}
            r.Events[4].AtMs=750; Reject(r); r.Events[4].AtMs=1100;
            r.Events.RemoveAt(4); Reject(r);
            Reject(new Recording {DurationMs=1000});
            var bad=new Recording {DurationMs=1000}; bad.Events.Add(new KeyEvent {Vk=65,Scan=30,Up=true}); Reject(bad);
            Assert(Recording.Reserved(0x77) && Recording.Reserved(0x79) && !Recording.Reserved(65),"Hotkey exclusion");
            Console.WriteLine("PASS: native ABI, overlapping keys, repeats, JSON roundtrip, order, unbalanced keys, hotkeys.");
            return 0;
        } catch(Exception e) { Console.Error.WriteLine(e); return 1; }
    }
}
}
