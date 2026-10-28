// 取自真实 AutoMod 逻辑文件的语法形态（内容为脱敏示例）
// 覆盖：模型初始化函数、arriving procedure、匿名 begin 块、oneof、use、order、clone nlt

begin model initialization function
  open "report.txt" for writing save result as V_report
  return true
end

begin P_in arriving procedure
  move into Q_in
  use R_check for 2 min
  set V_flag = oneof(0.95:1,0.05:0)
  if V_flag = 1 then
    begin
      if load type = L_a then
        send to P_m1
      if load type = L_b then
        send to P_m2
    end
  if V_flag = 0 then
    begin
      send to die
    end
end

begin P_m1 arriving procedure
  move into Q_m1
  use R_m1 for u 5,1 min
  set load type to L_a2
  move into Q_ass(1)
  wait to be ordered on OL_ass1
end

begin P_ass arriving procedure
  use R_ass for n 5,1 min
  order all loads from OL_assdummy to die
  move into Q_prod
  clone 1 load to P_out nlt L_dummy
  wait to be ordered on OL_assing
end
