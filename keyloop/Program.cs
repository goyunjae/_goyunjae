using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace KeyLoop {
internal static class Program {
    internal const string Version="1.0.1";
    [STAThread] static int Main(string[] args) {
        if(args.Contains("--self-test")) return SelfTest.Run();
        Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
        if(args.Contains("--register")) return Register();
        if(args.Contains("--unregister")) {
            Microsoft.Win32.Registry.CurrentUser.DeleteSubKeyTree(@"Software\Classes\keyloop",false);
            MessageBox.Show("웹 실행 연결을 해제했습니다. 프로그램 폴더는 직접 삭제할 수 있습니다.","KeyLoop"); return 0;
        }
        if(args.Contains("--preview")) {
            using(var form=new Studio()) {
                form.Show(); Application.DoEvents();
                using(var bitmap=new Bitmap(form.Width,form.Height)) {form.DrawToBitmap(bitmap,new Rectangle(0,0,form.Width,form.Height));bitmap.Save("KeyLoop-preview.png");}
                form.Close();
            }
            return 0;
        }
        bool play=args.Any(a=>a.Equals("keyloop://play",StringComparison.OrdinalIgnoreCase) || a.Equals("keyloop://play/",StringComparison.OrdinalIgnoreCase));
        IntPtr existing=Native.FindWindow(null,"KeyLoop · 키 입력 스튜디오");
        if(existing!=IntPtr.Zero) {
            Native.PostMessage(existing,0x8001,new IntPtr(play ? 2 : 1),IntPtr.Zero);
            Native.ShowWindow(existing,9); Native.SetForegroundWindow(existing); return 0;
        }
        Application.Run(new Studio(play)); return 0;
    }
    static int Register() {
        try {
            string directory=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"KeyLoop");
            string exe=Path.Combine(directory,"KeyLoop.exe");
            if(MessageBox.Show("KeyLoop를 사용자 앱 폴더에 복사하고, 이 PC에서 keyloop:// 링크로 열 수 있도록 연결합니다. 계속하시겠습니까?","웹 실행 연결",MessageBoxButtons.OKCancel)!=DialogResult.OK) return 0;
            Directory.CreateDirectory(directory);
            if(!String.Equals(Application.ExecutablePath,exe,StringComparison.OrdinalIgnoreCase)) File.Copy(Application.ExecutablePath,exe,true);
            using(var key=Microsoft.Win32.Registry.CurrentUser.CreateSubKey(@"Software\Classes\keyloop")) {
                key.SetValue("","URL:KeyLoop"); key.SetValue("URL Protocol","");
                using(var command=key.CreateSubKey(@"shell\open\command")) command.SetValue("","\""+exe+"\" \"%1\"");
            }
            MessageBox.Show("연결 완료. 웹페이지에서 '입력 화면 열기' 또는 '실행 화면 열기'를 누르세요.","KeyLoop");return 0;
        } catch(Exception e) {MessageBox.Show(e.Message,"연결 실패");return 1;}
    }
}
internal sealed class Studio : Form {
    readonly Color bg=Color.FromArgb(15,21,32), panel=Color.FromArgb(24,33,47), muted=Color.FromArgb(149,164,184), accent=Color.FromArgb(95,225,192);
    readonly System.Windows.Forms.Timer timer=new System.Windows.Forms.Timer {Interval=50};
    readonly Stopwatch clock=new Stopwatch();
    readonly Dictionary<string,KeyEvent> held=new Dictionary<string,KeyEvent>();
    readonly Native.HookProc hookProc;
    IntPtr hook, target;
    Recording recording;
    CancellationTokenSource cancel;
    Thread worker;
    volatile string workerMessage;
    volatile int loops;
    string state="idle", pending="";
    long countdownStarted;
    int recordLimit;
    bool closeAfterStop;
    Label status, counter, summary, targetLabel;
    TextBox eventView;
    NumericUpDown recordSeconds, runMinutes, delaySeconds;
    ComboBox inputMode, recordMode;
    bool rawRegistered;
    int received, rejected, readErrors;
    string lastDiagnostic="아직 녹화 진단이 없습니다.";
    Button recordButton, playButton, saveButton, loadButton, recordTab, playTab;
    Panel recordPanel, playPanel;
    ProgressBar progress;
    readonly List<Control> settings=new List<Control>();

    internal Studio(bool play=false) {
        Text="KeyLoop · 키 입력 스튜디오"; Size=new Size(960,760); MinimumSize=Size; MaximumSize=Size;
        StartPosition=FormStartPosition.CenterScreen; BackColor=bg; ForeColor=Color.White;
        Font=new Font("맑은 고딕",10); AutoScaleMode=AutoScaleMode.Dpi; MaximizeBox=false;
        hookProc=OnKey;
        AddLabel(this,"KEYLOOP  "+Program.Version,32,25,700,36,23,Color.White,FontStyle.Bold);
        AddLabel(this,"한 번의 입력, 원하는 시간만큼.",34,68,800,25,11,muted,FontStyle.Regular);
        recordTab=ButtonAt(this,"01  입력",32,114,180,43,delegate {ShowTab(true);});
        playTab=ButtonAt(this,"02  실행",222,114,180,43,delegate {ShowTab(false);});
        AddLabel(this,"F8 녹화   /   F9 실행   /   F10 긴급 정지",448,124,445,30,10,muted,FontStyle.Regular);
        recordPanel=new Panel {Bounds=new Rectangle(32,173,880,188),BackColor=panel}; Controls.Add(recordPanel);
        playPanel=new Panel {Bounds=recordPanel.Bounds,BackColor=panel}; Controls.Add(playPanel);
        AddLabel(recordPanel,"입력 녹화",22,16,500,32,17,Color.White,FontStyle.Bold);
        AddLabel(recordPanel,"시작 후 대상 창으로 이동하세요. 키를 누르고 뗀 시점을 기록합니다.",24,56,820,28,10,muted,FontStyle.Regular);
        AddLabel(recordPanel,"녹화 시간 (초)",24,100,200,26,10,muted,FontStyle.Regular);
        recordSeconds=NumberAt(recordPanel,24,129,160,1,3600,30);
        AddLabel(recordPanel,"녹화 방식",210,100,240,26,10,muted,FontStyle.Regular);
        recordMode=new ComboBox {Bounds=new Rectangle(210,129,270,35),DropDownStyle=ComboBoxStyle.DropDownList,BackColor=bg,ForeColor=Color.White};
        recordMode.Items.AddRange(new object[]{"Raw Input (기본)","키보드 후크 (기존 방식)"});recordMode.SelectedIndex=0;recordPanel.Controls.Add(recordMode);settings.Add(recordMode);
        recordButton=ButtonAt(recordPanel,"●  녹화 시작  F8",624,121,230,46,delegate {Arm("record");});
        AddLabel(playPanel,"반복 실행",22,16,500,32,17,Color.White,FontStyle.Bold);
        AddLabel(playPanel,"기록한 순서와 시간 간격을 반복합니다. 대상 창이 바뀌면 중지합니다.",24,56,820,28,10,muted,FontStyle.Regular);
        AddLabel(playPanel,"실행 시간 (분)",24,100,185,26,10,muted,FontStyle.Regular);
        runMinutes=NumberAt(playPanel,24,129,160,1,1440,10);
        AddLabel(playPanel,"입력 방식",210,100,240,26,10,muted,FontStyle.Regular);
        inputMode=new ComboBox {Bounds=new Rectangle(210,129,270,35),DropDownStyle=ComboBoxStyle.DropDownList,BackColor=bg,ForeColor=Color.White};
        inputMode.Items.AddRange(new object[]{"스캔 코드 (기본)","가상 키 코드"}); inputMode.SelectedIndex=0; playPanel.Controls.Add(inputMode); settings.Add(inputMode);
        playButton=ButtonAt(playPanel,"▶  반복 시작  F9",624,121,230,46,delegate {Arm("play");});
        AddLabel(this,"시작 대기 (초)",34,381,165,25,10,muted,FontStyle.Regular);
        delaySeconds=NumberAt(this,180,378,75,3,15,5);
        ButtonAt(this,"진단 복사",380,375,175,38,delegate {try {Clipboard.SetText(lastDiagnostic);status.Text="진단 내용을 복사했습니다.";} catch(Exception e) {MessageBox.Show(this,e.Message,"복사 실패");}});
        saveButton=ButtonAt(this,"녹화 저장",575,375,155,38,delegate {Save();});
        loadButton=ButtonAt(this,"불러오기",745,375,165,38,delegate {LoadRecording();});
        var monitor=new Panel {Bounds=new Rectangle(32,432,880,180),BackColor=panel}; Controls.Add(monitor);
        status=AddLabel(monitor,"준비됨",22,16,570,28,13,accent,FontStyle.Bold);
        counter=AddLabel(monitor,"00:00",660,12,193,45,26,Color.White,FontStyle.Bold); counter.TextAlign=ContentAlignment.TopRight;
        targetLabel=AddLabel(monitor,"대상 창: 시작 대기 종료 시 선택됩니다.",22,57,830,24,9,muted,FontStyle.Regular);
        summary=AddLabel(monitor,"녹화된 입력이 없습니다.",22,87,830,24,10,Color.White,FontStyle.Regular);
        progress=new ProgressBar {Bounds=new Rectangle(24,124,828,6),Maximum=1000,Style=ProgressBarStyle.Continuous}; monitor.Controls.Add(progress);
        eventView=new TextBox {Bounds=new Rectangle(22,141,830,26),ReadOnly=true,BorderStyle=BorderStyle.None,BackColor=panel,ForeColor=muted,TabStop=false}; monitor.Controls.Add(eventView);
        var stop=ButtonAt(this,"■  긴급 정지  F10",32,632,270,48,delegate {Stop("사용자가 중지했습니다.");}); stop.BackColor=Color.FromArgb(105,44,55); stop.ForeColor=Color.White;
        AddLabel(this,"키 기록은 녹화 중에만 수집하며 파일 저장은 직접 선택합니다.",326,634,580,23,9,muted,FontStyle.Regular);
        AddLabel(this,"메이플 작동 미검증 · 탐지 및 계정 제재 방지 보장 없음",326,658,580,23,9,muted,FontStyle.Regular);
        timer.Tick+=delegate {Tick();}; timer.Start();
        Shown+=delegate {
            bool ok8=Native.RegisterHotKey(Handle,8,0x4000,0x77);
            bool ok9=Native.RegisterHotKey(Handle,9,0x4000,0x78);
            bool ok10=Native.RegisterHotKey(Handle,10,0x4000,0x79);
            if(!ok10) {recordButton.Enabled=false; playButton.Enabled=false; MessageBox.Show(this,"F10 긴급 정지 등록에 실패했습니다. 단축키를 사용하는 다른 앱을 닫고 다시 실행하세요.","시작할 수 없음"); Close();}
            else if(!ok8 || !ok9) status.Text="F8/F9 등록 실패 · 화면의 시작 버튼을 사용하세요.";
        };
        FormClosing+=OnClosing;
        ShowTab(!play); RefreshSummary();
    }
    Label AddLabel(Control parent,string text,int x,int y,int w,int h,float size,Color color,FontStyle style) {
        var label=new Label {Text=text,Bounds=new Rectangle(x,y,w,h),ForeColor=color,Font=new Font("맑은 고딕",size,style),AutoEllipsis=true}; parent.Controls.Add(label); return label;
    }
    Button ButtonAt(Control parent,string text,int x,int y,int w,int h,EventHandler click) {
        var b=new Button {Text=text,Bounds=new Rectangle(x,y,w,h),FlatStyle=FlatStyle.Flat,BackColor=accent,ForeColor=bg,Cursor=Cursors.Hand,Font=new Font("맑은 고딕",10,FontStyle.Bold)};
        b.FlatAppearance.BorderSize=0; b.Click+=click; parent.Controls.Add(b); return b;
    }
    NumericUpDown NumberAt(Control parent,int x,int y,int w,int min,int max,int value) {
        var n=new NumericUpDown {Bounds=new Rectangle(x,y,w,36),Minimum=min,Maximum=max,Value=value,BackColor=bg,ForeColor=Color.White,Font=new Font("맑은 고딕",13),BorderStyle=BorderStyle.FixedSingle};
        parent.Controls.Add(n); settings.Add(n); return n;
    }
    void ShowTab(bool record) {
        recordPanel.Visible=record; playPanel.Visible=!record;
        recordTab.BackColor=record ? accent : panel; recordTab.ForeColor=record ? bg : muted;
        playTab.BackColor=record ? panel : accent; playTab.ForeColor=record ? muted : bg;
    }
    void Busy(bool busy) {
        settings.ForEach(c=>c.Enabled=!busy); recordButton.Enabled=!busy; playButton.Enabled=!busy && recording!=null;
        saveButton.Enabled=!busy && recording!=null; loadButton.Enabled=!busy;
    }
    void RefreshSummary() {
        summary.Text=recording==null ? "녹화된 입력이 없습니다." : String.Format("{0:N0}개 이벤트   ·   녹화 {1:0.00}초   ·   완료 {2:N0}회",recording.Events.Count,recording.DurationMs/1000.0,loops);
        if(state=="idle") Busy(false);
    }
    static string TimeText(double seconds) { var t=TimeSpan.FromSeconds(Math.Max(0,seconds)); return t.TotalHours>=1 ? t.ToString(@"hh\:mm\:ss") : t.ToString(@"mm\:ss"); }
    void Arm(string mode) {
        if(state!="idle") return;
        if(mode=="play" && recording==null) {status.Text="입력을 녹화하거나 파일을 먼저 불러오세요."; return;}
        pending=mode; state="countdown"; countdownStarted=Stopwatch.GetTimestamp(); Busy(true); ShowTab(mode=="record");
        targetLabel.Text="지금 대상 창으로 이동하고 모든 키를 놓으세요."; progress.Value=0;
    }
    void Tick() {
        if(state=="countdown") {
            double left=(double)delaySeconds.Value-(Stopwatch.GetTimestamp()-countdownStarted)/(double)Stopwatch.Frequency;
            status.Text=(pending=="record" ? "녹화" : "실행")+" 준비 · 대상 창으로 이동하세요"; counter.Text=Math.Max(0,Math.Ceiling(left)).ToString("0")+"초";
            if(left<=0) BeginOperation();
        } else if(state=="record") {
            if(Native.GetForegroundWindow()!=target || !Native.IsWindow(target)) {Stop("대상 창이 바뀌어 녹화를 중지했습니다.");return;}
            if(clock.ElapsedMilliseconds>=recordLimit) {Stop("녹화 완료 · 실행 탭에서 반복할 수 있습니다.");return;}
            counter.Text=TimeText((recordLimit-clock.ElapsedMilliseconds)/1000.0);
            progress.Value=(int)Math.Min(1000,clock.ElapsedMilliseconds*1000/recordLimit);
            summary.Text=recording.Events.Count+"개 이벤트 기록 중 · 수신 "+received+" / 제외 "+rejected+" / 오류 "+readErrors;
            eventView.Text=String.Join("   ",recording.Events.Skip(Math.Max(0,recording.Events.Count-10)).Select(e=>((Keys)e.Vk).ToString()+(e.Up ? " ↑" : " ↓")));
        } else if(state=="play") {
            double total=(double)runMinutes.Value*60;
            counter.Text=TimeText(total-clock.Elapsed.TotalSeconds); progress.Value=(int)Math.Min(1000,clock.Elapsed.TotalSeconds*1000/total); RefreshSummary();
            if(worker!=null && !worker.IsAlive) {
                state="idle"; worker=null; cancel.Dispose(); cancel=null; clock.Stop();
                status.Text=workerMessage ?? "실행 완료"; Busy(false);
                if(closeAfterStop) Close();
            }
        }
    }
    void BeginOperation() {
        target=Native.GetForegroundWindow(); uint pid; Native.GetWindowThreadProcessId(target,out pid);
        if(target==IntPtr.Zero || pid==(uint)Process.GetCurrentProcess().Id) {Stop("대상 창이 선택되지 않았습니다. 다시 시작하고 대상 창으로 이동하세요."); return;}
        for(int vk=8;vk<=254;vk++) {
            if((Native.GetAsyncKeyState(vk)&0x8000)!=0) {Stop("눌린 키가 있습니다. 모든 키를 놓고 다시 시작하세요."); return;}
        }
        targetLabel.Text="대상 창: "+Native.Title(target); loops=0;
        if(pending=="record") {
            received=0;rejected=0;readErrors=0;
            if(recordMode.SelectedIndex==0) {
                rawRegistered=RawInput.Register(Handle);
                if(!rawRegistered) {int error=Marshal.GetLastWin32Error();lastDiagnostic="Raw Input 등록 실패: "+error;Stop(lastDiagnostic);return;}
            } else {
                hook=Native.SetWindowsHookEx(13,hookProc,Native.GetModuleHandle(null),0);
                if(hook==IntPtr.Zero) {int error=Marshal.GetLastWin32Error();lastDiagnostic="키보드 후크 등록 실패: "+error;Stop(lastDiagnostic);return;}
            }
            recording=new Recording(); held.Clear(); recordLimit=(int)recordSeconds.Value*1000;
            clock.Restart(); state="record"; status.Text="● 녹화 중 · "+(rawRegistered ? "Raw Input" : "키보드 후크");
        } else {
            try {recording.Validate();} catch(Exception e) {Stop(e.Message);return;}
            cancel=new CancellationTokenSource(); workerMessage=null; state="play"; status.Text="▶ 반복 실행 중 · F10으로 즉시 중지";
            var snapshot=recording; bool scan=inputMode.SelectedIndex==0; long limit=(long)runMinutes.Value*60000;
            clock.Restart(); worker=new Thread(delegate(){Playback(snapshot,scan,limit,cancel.Token);}); worker.IsBackground=true; worker.Start();
        }
    }
    IntPtr OnKey(int code,IntPtr message,IntPtr data) {
        if(code>=0 && state=="record") {
            received++;
            var key=(Native.HookKey)Marshal.PtrToStructure(data,typeof(Native.HookKey));
            if((key.flags&0x12)==0 && key.scan>0 && key.scan<=255) {
                int msg=message.ToInt32();
                if(msg==0x100 || msg==0x101 || msg==0x104 || msg==0x105) {
                    var e=new KeyEvent {AtMs=(int)clock.ElapsedMilliseconds,Vk=(int)key.vk,Scan=(int)key.scan,Extended=(key.flags&1)!=0,Up=msg==0x101 || msg==0x105};
                    AppendKeyEvent(e);
                }
            } else rejected++;
        }
        return Native.CallNextHookEx(hook,code,message,data);
    }
    void OnRawInput(IntPtr handle) {
        if(state!="record" || !rawRegistered) return;
        received++;
        RawInput.Keyboard key;int error;
        if(!RawInput.Read(handle,out key,out error)) {readErrors++;return;}
        var e=RawInput.Decode(key,(int)clock.ElapsedMilliseconds);
        if(e==null) {rejected++;return;}
        AppendKeyEvent(e);
    }
    void AppendKeyEvent(KeyEvent e) {
        if(state!="record") return;
        if(e.Vk==0x79 && !e.Up) {Stop("사용자가 중지했습니다.");return;}
        if(Recording.Reserved(e.Vk) || Native.GetForegroundWindow()!=target || e.AtMs>=recordLimit) {rejected++;return;}
        if(e.Up && !held.ContainsKey(e.Identity)) {rejected++;return;}
        if(e.Up) held.Remove(e.Identity);else held[e.Identity]=e;
        recording.Events.Add(e);
        if(recording.Events.Count>=199700) Stop("녹화 이벤트 한도에 도달했습니다.");
    }
    void Playback(Recording r,bool scan,long limit,CancellationToken token) {
        var pressed=new Dictionary<string,KeyEvent>(); string result="설정한 실행 시간이 끝났습니다.";
        Func<bool> allowed=delegate {
            if(token.IsCancellationRequested) {result="사용자가 중지했습니다.";return false;}
            if(clock.ElapsedMilliseconds>=limit) return false;
            if(Native.GetForegroundWindow()!=target || !Native.IsWindow(target)) {result="대상 창이 바뀌어 실행을 중지했습니다.";return false;}
            return true;
        };
        Func<long,bool> wait=delegate(long due) {
            while(clock.ElapsedMilliseconds<due) {
                if(!allowed()) return false;
                token.WaitHandle.WaitOne((int)Math.Max(1,Math.Min(5,due-clock.ElapsedMilliseconds)));
            }
            return allowed();
        };
        try {
            long cycle=0;
            while(allowed()) {
                foreach(var e in r.Events) {
                    if(!wait(cycle+e.AtMs)) return;
                    if(clock.ElapsedMilliseconds-(cycle+e.AtMs)>250) {result="시스템 지연으로 시간 간격을 유지할 수 없어 중지했습니다.";return;}
                    if(!Native.Send(e,scan)) {result="입력이 차단되거나 전송에 실패했습니다. 실행을 중지했습니다.";return;}
                    if(e.Up) pressed.Remove(e.Identity); else pressed[e.Identity]=e;
                }
                if(!wait(cycle+r.DurationMs)) return;
                loops++; cycle+=r.DurationMs;
            }
        } catch(Exception e) {result="실행 오류: "+e.Message;}
        finally {
            bool released=true;
            foreach(var e in pressed.Values) {
                bool ok=false;
                for(int retry=0;retry<3 && !ok;retry++) ok=Native.Send(e.Release(0),scan);
                released &= ok;
            }
            workerMessage=result+(released ? "" : " 키 해제 실패: 눌린 키를 직접 눌렀다 놓으세요.");
        }
    }
    void Stop(string reason) {
        if(state=="play") {if(cancel!=null) cancel.Cancel(); status.Text="중지 중 · 눌린 키를 해제합니다."; return;}
        if(state=="record") {
            string method=rawRegistered ? "Raw Input" : "키보드 후크";
            if(rawRegistered) {RawInput.Remove();rawRegistered=false;}
            if(hook!=IntPtr.Zero) {Native.UnhookWindowsHookEx(hook);hook=IntPtr.Zero;}
            recording.DurationMs=(int)Math.Max(100,Math.Min(recordLimit,clock.ElapsedMilliseconds)); clock.Stop();
            foreach(var e in held.Values) recording.Events.Add(e.Release(recording.DurationMs)); held.Clear();
            lastDiagnostic="KeyLoop "+Program.Version+"\r\n방식: "+method+"\r\n대상: "+Native.Title(target)+"\r\n녹화 길이(ms): "+recording.DurationMs+"\r\n수신: "+received+"\r\n제외: "+rejected+"\r\n읽기 오류: "+readErrors+"\r\n저장 이벤트: "+recording.Events.Count+"\r\n종료: "+reason;
            if(recording.Events.Count==0) {
                recording=null;
                reason=received==0 ? method+" 입력 수신 0개 · 진단 복사로 상태 확인" : "수신 "+received+"개 / 저장 0개 · 진단 복사로 상태 확인";
            }
            else { try {recording.Validate();} catch(Exception e) {recording=null;reason="녹화 검증 실패: "+e.Message;} }
        }
        state="idle"; pending=""; status.Text=reason; counter.Text="00:00"; RefreshSummary();
    }
    void Save() {
        if(state!="idle" || recording==null)return;
        using(var dialog=new SaveFileDialog {Filter="KeyLoop 녹화 (*.keyloop.json)|*.keyloop.json",FileName="recording.keyloop.json"}) {
            if(dialog.ShowDialog(this)==DialogResult.OK) try {recording.Write(dialog.FileName);status.Text="녹화를 저장했습니다.";} catch(Exception e) {MessageBox.Show(this,e.Message,"저장 실패");}
        }
    }
    void LoadRecording() {
        if(state!="idle")return;
        using(var dialog=new OpenFileDialog {Filter="KeyLoop 녹화 (*.json)|*.json"}) {
            if(dialog.ShowDialog(this)==DialogResult.OK) try {recording=Recording.Read(dialog.FileName);loops=0;RefreshSummary();status.Text="녹화를 불러왔습니다.";ShowTab(false);} catch(Exception e) {MessageBox.Show(this,e.Message,"불러오기 실패");}
        }
    }
    protected override void WndProc(ref Message message) {
        if(message.Msg==0xff) OnRawInput(message.LParam);
        if(message.Msg==0x8001) ShowTab(message.WParam.ToInt32()!=2);
        if(message.Msg==0x312) {int id=message.WParam.ToInt32();if(id==10 && state!="idle")Stop("사용자가 중지했습니다.");else if(id==8)Arm("record");else if(id==9)Arm("play");}
        base.WndProc(ref message);
    }
    void OnClosing(object sender,FormClosingEventArgs e) {
        if(state=="play") {closeAfterStop=true;Stop("");e.Cancel=true;return;}
        Stop(""); timer.Stop();
        Native.UnregisterHotKey(Handle,8);Native.UnregisterHotKey(Handle,9);Native.UnregisterHotKey(Handle,10);
        if(hook!=IntPtr.Zero) Native.UnhookWindowsHookEx(hook);
        if(rawRegistered) RawInput.Remove();
    }
}
}
