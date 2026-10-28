! 典型的 AutoMod 逻辑控制程序：只有逻辑块，没有 begin model 外壳
! 文件扩展名为 .m

begin P_arrive
  move load to P_load
end

begin P_load
  move load to P_process
end

begin P_process
  if var_busy > 0 then
    wait for 30 sec
  else
    set var_busy = 1
  end
  move load to P_done
end

begin P_done
  set var_busy = 0
  stop
end
