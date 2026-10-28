begin model bad
begin process P
  integer var_count
  integer var_count

  begin P_a
    move load to P_missing
    wait for -5
    set var_x = 10 / 0
    stop
    inc var_count
  end

  begin P_b
  end

  begin P_c
    move load to P_missing2
  end
end
end model
after model junk
